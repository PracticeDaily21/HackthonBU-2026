from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Literal
import re
import random
import spacy
from faker import Faker

fake = Faker()

app = FastAPI(title="PromptShield API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

nlp = spacy.load("en_core_web_sm")

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b")
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

ENTITY_COLORS = {
    "PERSON": "#3b82f6",
    "ORG": "#10b981",
    "GPE": "#f59e0b",
    "EMAIL": "#8b5cf6",
    "PHONE": "#ef4444",
    "SSN": "#dc2626",
}

RISK_WEIGHTS = {
    "SSN": 40,
    "PHONE": 20,
    "EMAIL": 20,
    "PERSON": 10,
    "ORG": 5,
    "GPE": 5,
}

CATEGORY_MAP = {
    "PERSON": "[PERSON]",
    "ORG": "[COMPANY]",
    "GPE": "[LOCATION]",
    "EMAIL": "[EMAIL]",
    "PHONE": "[PHONE]",
    "SSN": "[SSN]",
}

NOISY_ORG_MAP = {
    "Microsoft": "Macrosoft",
    "Google": "Googol",
    "OpenAI": "OpenGen",
    "Apple": "Pear Systems",
    "Amazon": "Rainforest Inc",
}

GENERIC_PERSONS = ["a customer", "a user", "an employee", "a client"]
GENERIC_LOCS = ["a major city", "a location", "a metropolitan area"]


class Entity(BaseModel):
    id: str
    text: str
    start: int
    end: int
    label: str
    color: str


class DetectRequest(BaseModel):
    prompt: str


class DetectResponse(BaseModel):
    entities: List[Entity]
    privacy_risk_score: int


class TransformChoice(BaseModel):
    entity_id: str
    mode: Literal["keep", "generalize", "noise"]


class TransformRequest(BaseModel):
    prompt: str
    entities: List[Entity]
    choices: List[TransformChoice]


class TransformResponse(BaseModel):
    sanitized_prompt: str
    privacy_risk_score_before: int
    privacy_risk_score_after: int
    compatibility_score: int
    compatibility_note: str


def score_risk(entities: List[Entity]) -> int:
    total = sum(RISK_WEIGHTS.get(e.label, 0) for e in entities)
    return min(total, 100)


def overlap(start: int, end: int, spans: List[tuple]) -> bool:
    for s, e in spans:
        if not (end <= s or start >= e):
            return True
    return False


def detect_regex_entities(text: str) -> List[Entity]:
    entities: List[Entity] = []
    taken = []
    patterns = [
        (EMAIL_RE, "EMAIL"),
        (PHONE_RE, "PHONE"),
        (SSN_RE, "SSN"),
    ]

    for pattern, label in patterns:
        for i, match in enumerate(pattern.finditer(text)):
            start, end = match.start(), match.end()
            if overlap(start, end, taken):
                continue
            taken.append((start, end))
            entities.append(
                Entity(
                    id=f"regex-{label}-{i}-{start}",
                    text=match.group(),
                    start=start,
                    end=end,
                    label=label,
                    color=ENTITY_COLORS[label],
                )
            )
    return entities


def detect_ner_entities(text: str, existing: List[Entity]) -> List[Entity]:
    entities: List[Entity] = []
    taken = [(e.start, e.end) for e in existing]
    doc = nlp(text)
    allowed = {"PERSON", "ORG", "GPE"}
    counter = 0

    for ent in doc.ents:
        if ent.label_ not in allowed:
            continue
        if overlap(ent.start_char, ent.end_char, taken):
            continue
        entities.append(
            Entity(
                id=f"ner-{ent.label_}-{counter}-{ent.start_char}",
                text=ent.text,
                start=ent.start_char,
                end=ent.end_char,
                label=ent.label_,
                color=ENTITY_COLORS[ent.label_],
            )
        )
        taken.append((ent.start_char, ent.end_char))
        counter += 1

    return entities


def detect_entities(text: str) -> List[Entity]:
    regex_entities = detect_regex_entities(text)
    ner_entities = detect_ner_entities(text, regex_entities)
    all_entities = regex_entities + ner_entities
    all_entities.sort(key=lambda x: x.start)
    return all_entities


def noisy_phone(value: str) -> str:
    digits = [c for c in value if c.isdigit()]
    if len(digits) < 4:
        return "[PHONE]"
    last4 = "".join(digits[-4:])
    noisy_last4 = str((int(last4) + random.randint(7, 91)) % 10000).zfill(4)
    prefix = "".join(digits[:-4])
    full = prefix + noisy_last4
    if len(full) == 10:
        return f"{full[:3]}-{full[3:6]}-{full[6:]}"
    return full


def noisy_person(value: str) -> str:
    return fake.name()

def noisy_org(value: str) -> str:
    return fake.company()

def noisy_gpe(value: str) -> str:
    return fake.city()


def noisy_email(value: str) -> str:
    return fake.email()

def noisy_phone(value: str) -> str:
    return fake.phone_number()


def replacement_for(entity: Entity, mode: str) -> str:
    if mode == "keep":
        return entity.text
    if mode == "generalize":
        return CATEGORY_MAP.get(entity.label, "[REDACTED]")
    if mode == "noise":
        if entity.label == "PHONE":
            return noisy_phone(entity.text)
        if entity.label == "PERSON":
            return noisy_person(entity.text)
        if entity.label == "ORG":
            return noisy_org(entity.text)
        if entity.label == "GPE":
            return noisy_gpe(entity.text)
        if entity.label == "EMAIL":
            return noisy_email(entity.text)
        if entity.label == "SSN":
            return noisy_ssn(entity.text)
    return entity.text


def compute_compatibility(original: str, sanitized: str) -> Dict[str, object]:
    if not original.strip():
        return {"score": 100, "note": "Empty prompt."}

    original_words = len(original.split())
    sanitized_words = len(sanitized.split())
    ratio = sanitized_words / max(original_words, 1)
    placeholders = len(re.findall(r"\[[A-Z_]+\]", sanitized))

    if ratio < 0.45 or placeholders > 8:
        return {
            "score": 58,
            "note": "Prompt meaning may be degraded. Consider keeping more context.",
        }
    if ratio < 0.65:
        return {
            "score": 78,
            "note": "Prompt is still usable, but some context has been reduced.",
        }
    return {
        "score": 92,
        "note": "Prompt still looks understandable for AI.",
    }


@app.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest):
    entities = detect_entities(req.prompt)
    return DetectResponse(
        entities=entities,
        privacy_risk_score=score_risk(entities),
    )


@app.post("/transform", response_model=TransformResponse)
def transform(req: TransformRequest):
    choice_map = {c.entity_id: c.mode for c in req.choices}
    entities = sorted(req.entities, key=lambda e: e.start)

    parts = []
    cursor = 0
    remaining_entities = []

    for entity in entities:
        parts.append(req.prompt[cursor:entity.start])
        mode = choice_map.get(entity.id, "keep")
        repl = replacement_for(entity, mode)
        parts.append(repl)
        cursor = entity.end
        if mode == "keep":
            remaining_entities.append(entity)

    parts.append(req.prompt[cursor:])
    sanitized = "".join(parts)

    compatibility = compute_compatibility(req.prompt, sanitized)

    return TransformResponse(
        sanitized_prompt=sanitized,
        privacy_risk_score_before=score_risk(req.entities),
        privacy_risk_score_after=score_risk(remaining_entities),
        compatibility_score=int(compatibility["score"]),
        compatibility_note=str(compatibility["note"]),
    )