const EventEmitter = require("events");
const uuid = require("uuid");

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = "";
  }
  //Constructor for Audio stream
  setStreamSid(streamSid) {
    this.streamSid = streamSid;
  }
  //It is converting the audio into buffer
  buffer(index, audio) {
    // Escape hatch for intro message, which doesn't have an index
    //when index is null respond with audio
    if (index === null) {
      this.sendAudio(audio);
    }
    //it will handle the intermediate audio
    else if (index === this.expectedAudioIndex) {
      this.sendAudio(audio);
      this.expectedAudioIndex++;

      while (this.audioBuffer.hasOwnProperty(this.expectedAudioIndex)) {
        const bufferedAudio = this.audioBuffer[this.expectedAudioIndex];
        this.sendAudio(bufferedAudio);
        this.expectedAudioIndex++;
      }
    } else {
      this.audioBuffer[index] = audio;
    }
  }

  // This event will stream the audio
  sendAudio(audio) {
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: "media",
        media: {
          payload: audio,
        },
      })
    );
    // When the media completes you will receive a `mark` message with the label
    const markLabel = uuid.v4();
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: "mark",
        mark: {
          name: markLabel,
        },
      })
    );
    this.emit("audiosent", markLabel);
  }
}

module.exports = { StreamService };
