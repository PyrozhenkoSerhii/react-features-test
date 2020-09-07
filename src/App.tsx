import * as React from "react";
/**
 * @types/recordrtc is broken, thus we use this lib without typing
 */
import * as RecordRTCPromisesHandler from "recordrtc";

import { Wrapper } from "./styled";
import { saveByteArray } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mergeLeftRightBuffers } = require("../merge");

const { useEffect, useState, useRef } = React;
const { StereoAudioRecorder } = RecordRTCPromisesHandler;

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
        type: "audio",
        recorderType: StereoAudioRecorder,
      });
      recorder.startRecording();
      audioRef.current.srcObject = stream;

      setTimeout(() => {
        recorder.stopRecording(() => {
          const internalRecorder = recorder.getInternalRecorder();

          const { leftchannel, rightchannel } = internalRecorder;

          mergeLeftRightBuffers({
            desiredSampRate: internalRecorder.desiredSampRate,
            sampleRate: internalRecorder.sampleRate,
            numberOfAudioChannels: internalRecorder.numberOfAudioChannels,
            internalInterleavedLength: internalRecorder.recordingLength,
            leftBuffers: leftchannel,
            rightBuffers: internalRecorder.numberOfAudioChannels === 1 ? [] : rightchannel,
          }, (buffer: ArrayBuffer) => {
            const blob = new Blob([buffer], { type: "audio/wav" });
            audioRef.current.srcObject = null;
            audioRef.current.src = URL.createObjectURL(blob);

            saveByteArray([buffer], "test.bin");
          });
        });
      }, 10000);
    }
  }, [stream]);

  return (
    <Wrapper>
      <audio ref={audioRef} controls autoPlay playsInline muted />
    </Wrapper>
  );
};
