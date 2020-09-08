/* eslint-disable @typescript-eslint/ban-ts-comment */
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

let blob = null;
const blobs = [];
const arrayOfBlobs = [];
const times = 0;

export const App = (): JSX.Element => {
  const [stream, setStream] = useState<MediaStream>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const getAudioStream = async () => {
    setStream(await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    }));
  };

  // const [blob, setBlob] = useState(null);

  useEffect(() => {
    getAudioStream();
  }, []);

  useEffect(() => {
    if (stream) {
      const recorder = new RecordRTCPromisesHandler(stream, {
        type: "audio/wav",
        recorderType: StereoAudioRecorder,
        timeSlice: 1000,
        ondataavailable: async (newBlob: Blob) => {
          console.log("accumulator Blob: ", blob);
          console.log("new Blob: ", newBlob);
          if (!blob) {
            blob = newBlob;
          } else {
          // @ts-ignore
            ConcatenateBlobs([blob, newBlob], { type: "audio/wav" }, (resultingBlob) => {
              blob = resultingBlob;
            });
          }
        },
      });
      recorder.startRecording();
      audioRef.current.srcObject = stream;

      setTimeout(() => {
        recorder.stopRecording(() => {
          // @ts-ignore
          // ConcatenateBlobs(blobs, { type: "audio/wav" }, (resultingBlob) => {
          //   console.log(resultingBlob);
          //   audioRef.current.srcObject = null;
          //   audioRef.current.src = URL.createObjectURL(resultingBlob);
          // });

          // console.log("Blob in <audio>: ", blob);

          audioRef.current.srcObject = null;
          audioRef.current.src = URL.createObjectURL(blob);

          // const internalRecorder = recorder.getInternalRecorder();

          // const { leftchannel, rightchannel } = internalRecorder;

          // console.log(leftchannel, rightchannel);

          // mergeLeftRightBuffers({
          //   desiredSampRate: internalRecorder.desiredSampRate,
          //   sampleRate: internalRecorder.sampleRate,
          //   numberOfAudioChannels: internalRecorder.numberOfAudioChannels,
          //   internalInterleavedLength: internalRecorder.recordingLength,
          //   leftBuffers: leftchannel,
          //   rightBuffers: internalRecorder.numberOfAudioChannels === 1 ? [] : rightchannel,
          // }, (buffer: ArrayBuffer) => {
          //   // const blob = new Blob([buffer], { type: "audio/wav" });
          //   // @ts-ignore
          //   // ConcatenateBlobs(blobs, { type: "audio/webm" }, (resultingBlob) => {
          //   //   console.log(resultingBlob);
          //   //   audioRef.current.srcObject = null;

          //   //   audioRef.current.src = URL.createObjectURL(resultingBlob);
          //   // });

          //   audioRef.current.srcObject = null;
          //   audioRef.current.src = URL.createObjectURL(blob);

          //   saveByteArray([buffer], "test.bin");
          // });
        });
      }, 5000);
    }
  }, [stream]);

  // const loopRecording = () => {
  //   const recorder = new RecordRTCPromisesHandler(stream, {
  //     type: "audio/wav",
  //     recorderType: StereoAudioRecorder,
  //     timeSlice: 1000,
  //     ondataavailable: async (newBlob: Blob) => {
  //       times += 1;
  //       console.log(blob);
  //       if (!blob) {
  //         blob = newBlob;
  //       } else {
  //         blob = new Blob([blob, newBlob], { type: "audio/wav" });
  //       }
  //       // blobs.push(newBlob);
  //       // console.log("from loop", newBlob);
  //       if (times >= 5) {
  //         // @ts-ignore
  //         // ConcatenateBlobs(blobs, { type: "audio/wav" }, (resultingBlob) => {
  //         //   console.log(resultingBlob);
  //         //   audioRef.current.srcObject = null;
  //         //   audioRef.current.src = URL.createObjectURL(resultingBlob);
  //         // });
  //         audioRef.current.srcObject = null;
  //         audioRef.current.src = URL.createObjectURL(blob);

  //         recorder.stopRecording();
  //         return;
  //       }
  //       loopRecording();
  //       recorder.stopRecording();
  //     },
  //   });
  //   recorder.startRecording();
  // };

  // useEffect(() => {
  //   if (stream) {
  //     loopRecording();
  //   }
  //   audioRef.current.srcObject = stream;
  // }, [stream]);

  // useEffect(() => {
  //   if (stream) {
  //     const recorder = new MediaRecorder(stream, {
  //       mimeType: "audio/webm",
  //     });
  //     recorder.ondataavailable = (event) => {
  //       console.log(event.data);
  //       arrayOfBlobs.push(event.data);
  //     };
  //     recorder.start(1000);

  //     setTimeout(() => {
  //       recorder.stop();
  //       const singleBlob = new Blob(arrayOfBlobs, {
  //         type: "audio/webm",
  //       });
  //       console.log(singleBlob);
  //       audioRef.current.srcObject = null;
  //       audioRef.current.src = URL.createObjectURL(singleBlob);
  //     }, 5000);
  //   }
  // }, [stream]);

  console.log(blob);

  return (
    <Wrapper>
      <audio ref={audioRef} controls autoPlay playsInline muted />
    </Wrapper>
  );
};
