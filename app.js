require("dotenv").config();
const express = require("express");
const ExpressWs = require("express-ws");
const colors = require("colors");

const { GptService } = require("./services/gpt-service");
const { StreamService } = require("./services/stream-service");
const { TranscriptionService } = require("./services/transcription-service");
const { TextToSpeechService } = require("./services/tts-service");

const app = express();
ExpressWs(app);

const PORT = 4000;
// connecting to the phonecall


app.ws("/connection", (ws, req) => {
  ws.on("error", console.error); // error while connnecting to the phonecall
  // Filled in from start message
  let streamSid;

  const gptService = new GptService();
  const streamService = new StreamService(ws);
  const transcriptionService = new TranscriptionService();
  const ttsService = new TextToSpeechService({});

  let marks = [];
  let interactionCount = 0;

  // Incoming from MediaStream
  ws.on("message", function message(data) {
    //recieving the message from the phonecall
    const msg = JSON.parse(data);
    if (msg.event === "start") {
      streamSid = msg.start.streamSid;
      streamService.setStreamSid(streamSid);
      console.log(
        `Twilio -> Starting Media Stream for ${streamSid}`.underline.red
      );
      ttsService.generate(
        // first greet message
        {
          partialResponseIndex: null,
          partialResponse: "Hello! How can I assist you today?",
        },
        1
      );
    } else if (msg.event === "media") {
      transcriptionService.send(msg.media.payload); //to deepgram to transcribe
    } else if (msg.event === "mark") {
      // marking end of message
      const label = msg.mark.name;
      console.log(
        `Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`.red
      );
      marks = marks.filter((m) => m !== msg.mark.name);
    } else if (msg.event === "stop") {
      console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);
    }
  });

  transcriptionService.on("utterance", async (text) => {
    // interruption logic
    if (marks.length > 0 && text?.length > 5) {
      console.log("Twilio -> Interruption, Clearing stream".red);
      ws.send(
        JSON.stringify({
          streamSid,
          event: "clear",
        })
      );
    }
  });

  transcriptionService.on("transcription", async (text) => {
    //transcribing
    if (!text) {
      return;
    }
    console.log(`Interaction ${interactionCount} – STT -> GPT: ${text} - total time  ${totalTime}ms`.yellow);
    gptService.completion(text, interactionCount,totalTime);
    interactionCount += 1;
  });

  gptService.on("gptreply", async (gptReply, icount,totalTime) => {
    console.log(
      `Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse} - total time ${totalTime}ms`.green //gpt response
    );
    ttsService.generate(gptReply, icount,totalTime);
  });

  ttsService.on("speech", (responseIndex, audio, label, icount,totalTime) => {
    //sending audio to stream
    console.log(`Interaction ${icount}: TTS -> TWILIO: ${label} - total time ${totalTime}`.blue);

    streamService.buffer(responseIndex, audio,totalTime);
  });

  streamService.on("audiosent", (markLabel) => {
    marks.push(markLabel);
  }); // marking audio as sent
});

app.listen(4000);
console.log(`Server running on port 4000`);
