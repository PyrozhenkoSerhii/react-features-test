import * as React from "react";
/**
 * @types/recordrtc is broken, thus we use this lib without typing
 */
import * as RecordRTCPromisesHandler from "recordrtc";

import { Wrapper } from "./styled";
import { downloadFile, getFileName, saveByteArray } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mergeLeftRightBuffers } = require("../merge");

const { useEffect, useState, useRef } = React;
const { StereoAudioRecorder } = RecordRTCPromisesHandler;

let counter = 0;
let read = 0;

export const App = (): JSX.Element => {
  const [stream, setStream] = useState<MediaStream>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const getAudioStream = async () => {
    setStream(await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    }));
  };

  useEffect(() => {
    getAudioStream();
  }, []);

  useEffect(() => {
    if (stream) {
      const recorder = new RecordRTCPromisesHandler(stream, {
        type: "audio/wav",
        recorderType: StereoAudioRecorder,
        timeSlice: 5000,
        ondataavailable: () => {
          counter += 1;
          const internalRecorder = recorder.getInternalRecorder();

          const { leftchannel, rightchannel } = internalRecorder;

          const readItemsLeft = read ? leftchannel.slice(read) : leftchannel;
          // const readItemsRight = read ? rightchannel.slice(read) : rightchannel;

          const readItemsCount = Object.keys(readItemsLeft).length;

          read += readItemsCount;

          // mergeLeftRightBuffers({
          //   desiredSampRate: internalRecorder.desiredSampRate,
          //   sampleRate: internalRecorder.sampleRate,
          //   numberOfAudioChannels: internalRecorder.numberOfAudioChannels,
          //   internalInterleavedLength: internalRecorder.recordingLength,
          //   leftBuffers: readItemsLeft,
          //   rightBuffers: internalRecorder.numberOfAudioChannels === 1 ? [] : readItemsRight,
          // }, (buffer: ArrayBuffer) => {
          //   const blob = new Blob([buffer], { type: "audio/wav" });
          //   audioRef.current.srcObject = null;
          //   audioRef.current.src = URL.createObjectURL(blob);

          //   downloadFile(blob, getFileName(counter));
          //   saveByteArray([buffer], "test.bin");
          // });

          saveByteArray(readItemsLeft, getFileName(counter));
          console.log(`Read in total: ${read} items`);
          console.log("Read items: ", readItemsLeft);
          console.log("Whole recording buffer: ", leftchannel);
        },
      });
      recorder.startRecording();
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <Wrapper>
      <audio ref={audioRef} controls autoPlay playsInline muted />
    </Wrapper>
  );
};
