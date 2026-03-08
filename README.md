# HackthonBU-2026
PromptShield : Interactive Privacy-Preserving Prompt Sanitizer
An interactive prompt privacy filter that detects sensitive information in user prompts, highlights it visually, and lets users choose how each item should be transformed.

<img width="580" height="763" alt="PromptShield" src="https://github.com/user-attachments/assets/6f667de8-0684-41c4-b5a7-36f0a65bb458" />

## Inspiration
People use AI chats a lot nowadays, and some conversation include sensitive information that needs privacy protection. I am thinking of creating a local tool to filter the prompt before sending to global AI chats.
## What it does
My filter tool can take the prompt and highlight the sensitive infor![Uploading PromptShield.png…]()
mation by category visually with color, then users have their choice how they want them to be transformed, such as keep them, replace with other words, generalize them. The tool can also measure the risk score of privacy leakage before and after the filtering work, and it can further tell how much meaning is preserved after the filtering.
## How we built it
I built this tool by coding in python for the backend and frontend.
## Challenges we ran into
I used this python package faker to generate different new words as replacement of sensitive info, but the backend has limited list of answers for "what should be defined as sensitive info", I am thinking of whatever can be output by faker package, it could be regarded as my choices in that list, though not all categories output by faker package is sensitive. The sensitive information could really be defined by any specific interest. So I will keep that option open.
## Accomplishments that we're proud of
This is my first time coding both for the backend and frontend, and see the results so quickly given the limited time of trying. I am glad it all works. I am more interested in coding now.
## What we learned
I learnt that it is hard to define what sensitive information could be sometimes, because the irrelevant non-sensitive information can reveal important things in some way. Privacy protection has a long way to go.
## What's next for Interactive AI Prompts Privacy Filter 
I want to teach my tool to distinguish the sensitive information better and more accurate. The frontend page could look better with more options, like "clear page". Also, I have this one-click button to choose a default action for all sensitive texts, but I have not yet add a one-click button for each possible method that applies all texts. 
## Reference
This project is for Hackthon Bu 2026. The ideas are all mine. I used ChatGPT to help with the code, as I honestly have no prior hands-on experiences for frontend and backend lol. I kept asking questions and learnt a lot about how - step by step - to achieve what I finally want. Given the limited time and ability, I still have not tried how to achieve more ideas that I like, but I am satisfied for now and I will leave them for future!
