import React, { useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

const DEFAULT_PROMPT =
  "My name is Alice Johnson, I work at Microsoft, my email is alice.johnson@gmail.com, and my phone number is 917-555-1234. Please help me summarize my work update.";

function App() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [entities, setEntities] = useState([]);
  const [choices, setChoices] = useState({});
  const [riskScore, setRiskScore] = useState(0);
  const [output, setOutput] = useState("");
  const [afterRisk, setAfterRisk] = useState(null);
  const [compatibility, setCompatibility] = useState(null);
  const [compatibilityNote, setCompatibilityNote] = useState("");
  const [loading, setLoading] = useState(false);

  const highlightedPrompt = useMemo(() => {
    if (!entities.length) return prompt;

    const pieces = [];
    let cursor = 0;

    entities.forEach((entity) => {
      pieces.push(
        <span key={`text-${cursor}`}>{prompt.slice(cursor, entity.start)}</span>
      );
      pieces.push(
        <span
          key={entity.id}
          style={{
            backgroundColor: `${entity.color}33`,
            border: `1px solid ${entity.color}`,
            borderRadius: "8px",
            padding: "1px 6px",
            margin: "0 1px",
            display: "inline-block",
          }}
          title={`${entity.label}: ${entity.text}`}
        >
          {prompt.slice(entity.start, entity.end)}
        </span>
      );
      cursor = entity.end;
    });

    pieces.push(<span key="tail">{prompt.slice(cursor)}</span>);
    return pieces;
  }, [prompt, entities]);

  const handleDetect = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setEntities(data.entities || []);
      setRiskScore(data.privacy_risk_score || 0);

      const initialChoices = {};
      (data.entities || []).forEach((entity) => {
        initialChoices[entity.id] = "generalize";
      });
      setChoices(initialChoices);
      setOutput("");
      setAfterRisk(null);
      setCompatibility(null);
      setCompatibilityNote("");
    } catch (e) {
      alert("Failed to connect to backend. Make sure FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const handleChoiceChange = (entityId, mode) => {
    setChoices((prev) => ({ ...prev, [entityId]: mode }));
  };

  const handleTransform = async () => {
    setLoading(true);
    try {
      const payload = {
        prompt,
        entities,
        choices: entities.map((entity) => ({
          entity_id: entity.id,
          mode: choices[entity.id] || "keep",
        })),
      };

      const res = await fetch(`${API_BASE}/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setOutput(data.sanitized_prompt || "");
      setAfterRisk(data.privacy_risk_score_after ?? 0);
      setCompatibility(data.compatibility_score ?? 0);
      setCompatibilityNote(data.compatibility_note || "");
    } catch (e) {
      alert("Transform failed.");
    } finally {
      setLoading(false);
    }
  };


  const handleOneClickProtect = () => {
  const nextChoices = {};
  entities.forEach((entity) => {
    if (["PHONE", "EMAIL", "SSN"].includes(entity.label)) {
      nextChoices[entity.id] = "generalize";
    } else if (entity.label === "ORG") {
      nextChoices[entity.id] = "noise";
    } else {
      nextChoices[entity.id] = "generalize";
    }
  });
  setChoices(nextChoices);
};

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        padding: "32px 16px",
        fontFamily: "Arial, sans-serif",
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "40px" }}>PromptShield</h1>
        <p style={{ color: "#6b7280" }}>
          Interactive privacy-preserving prompt sanitizer
        </p>

        <div style={cardStyle}>
          <div style={headerStyle}>
            <h2 style={h2Style}>Original Prompt</h2>
            <button style={buttonStyle} onClick={handleDetect} disabled={loading}>
              {loading ? "Processing..." : "Detect Sensitive Info"}
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            style={textareaStyle}
          />
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}>Highlighted Prompt</h2>
          <div style={boxStyle}>{highlightedPrompt}</div>
        </div>

        <div style={cardStyle}>
          <div style={headerStyle}>
            <h2 style={h2Style}>Detected Sensitive Information</h2>
            <button
              style={buttonStyle}
              onClick={handleOneClickProtect}
              disabled={!entities.length}
            >
              One-Click Protection
            </button>
          </div>

          {!entities.length ? (
            <p style={{ color: "#6b7280" }}>No entities detected yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thtdStyle}>Text</th>
                  <th style={thtdStyle}>Type</th>
                  <th style={thtdStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity) => (
                  <tr key={entity.id}>
                    <td style={thtdStyle}>{entity.text}</td>
                    <td style={thtdStyle}>
                      <span
                        style={{
                          backgroundColor: `${entity.color}22`,
                          color: entity.color,
                          padding: "6px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {entity.label}
                      </span>
                    </td>
                    <td style={thtdStyle}>
                      <select
                        value={choices[entity.id] || "keep"}
                        onChange={(e) => handleChoiceChange(entity.id, e.target.value)}
                        style={selectStyle}
                      >
                        <option value="keep">Keep</option>
                        <option value="generalize">Generalize</option>
                        <option value="noise">Noise-based</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: "flex", gap: "16px", marginTop: "20px", flexWrap: "wrap" }}>
          <div style={smallCardStyle}>
            <h3 style={h3Style}>Privacy Risk Score</h3>
            <div style={scoreStyle}>{riskScore}</div>
            <p style={{ color: "#6b7280" }}>Before sanitization</p>
          </div>
          <div style={smallCardStyle}>
            <h3 style={h3Style}>Risk After</h3>
            <div style={scoreStyle}>{afterRisk ?? "-"}</div>
            <p style={{ color: "#6b7280" }}>After sanitization</p>
          </div>
          <div style={smallCardStyle}>
            <h3 style={h3Style}>AI Compatibility</h3>
            <div style={scoreStyle}>{compatibility ?? "-"}</div>
            <p style={{ color: "#6b7280" }}>Meaning preserved</p>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={headerStyle}>
            <h2 style={h2Style}>Sanitized Prompt</h2>
            <button
              style={buttonStyle}
              onClick={handleTransform}
              disabled={!entities.length || loading}
            >
              Generate Safe Prompt
            </button>
          </div>
          <div style={boxStyle}>
            {output || "Your protected prompt will appear here."}
          </div>
          {compatibilityNote ? (
            <p style={{ marginTop: "12px", color: "#374151" }}>{compatibilityNote}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  marginTop: "20px",
};

const smallCardStyle = {
  ...cardStyle,
  flex: 1,
  minWidth: "220px",
  marginTop: 0,
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "12px",
  flexWrap: "wrap",
};

const h2Style = { margin: 0, fontSize: "22px" };
const h3Style = { marginTop: 0, marginBottom: "8px", fontSize: "16px" };

const buttonStyle = {
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "14px",
  cursor: "pointer",
  background: "#111827",
  color: "white",
};

const textareaStyle = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "14px",
  fontSize: "15px",
  resize: "vertical",
};

const boxStyle = {
  minHeight: "120px",
  padding: "14px",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  background: "#fafafa",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
};

const thtdStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
};

const selectStyle = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "8px 10px",
};

const scoreStyle = {
  fontSize: "36px",
  fontWeight: 700,
};

export default App;