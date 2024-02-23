const EventEmitter = require("events");
const colors = require("colors");
const OpenAI = require("openai");

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI();
    (this.userContext = [
      {
        role: "system",
        content:
          "You are an assistant.You have a youthful and cheery personality. Keep your responses as brief as possible but make every attempt to keep the caller on the phone without being rude. Don't ask more than 1 question at a time. Don't make assumptions about the questions user is asking. Ask for clarification if a user request is ambiguous. You must add a '•' symbol every 5 to 10 words at natural pauses where your response can be split for text to speech.",
      },
      { role: "assistant", content: "Hello! I am here to assist you?" },
    ]),
      (this.partialResponseIndex = 0);
  }

  async completion(text, interactionCount, role = "user", name = "user") {
    if (name != "user") {
      this.userContext.push({ role: role, name: name, content: text });
    } else {
      this.userContext.push({ role: role, content: text });
    }

    // Step 1: Send user transcription to Chat GPT
    const stream = await this.openai.chat.completions.create({
      // model: "gpt-4-1106-preview",
      model: "gpt-4",
      messages: this.userContext,
      stream: true,
    });

    let completeResponse = "";
    let partialResponse = "";
    let finishReason = "";

    for await (const chunk of stream) {
      let content = chunk.choices[0]?.delta?.content || "";

      // Step 2: check if GPT wanted to call a function
      // check to see if it is finished
      finishReason = chunk.choices[0].finish_reason;

      // need to call function on behalf of Chat GPT with the arguments it parsed from the conversation
      // We use completeResponse for userContext
      completeResponse += content;
      // We use partialResponse to provide a chunk for TTS
      partialResponse += content;
      // Emit last partial response and add complete response to userContext
      if (content.trim().slice(-1) === "•" || finishReason === "stop") {
        const gptReply = {
          partialResponseIndex: this.partialResponseIndex,
          partialResponse,
        };

        this.emit("gptreply", gptReply, interactionCount);
        this.partialResponseIndex++;
        partialResponse = "";
      }
    }
    this.userContext.push({ role: "assistant", content: completeResponse });
    console.log(`GPT -> user context length: ${this.userContext.length}`.green);
  }
}

module.exports = { GptService };
