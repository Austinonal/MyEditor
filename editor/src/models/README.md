# Bundled models

- `selfie_segmenter.tflite`: MediaPipe selfie segmenter (float16, 256 x 256), Apache-2.0, from
  https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
  (sha256 191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b). Used by `src/segment.ts`.

The Whisper model for auto captions is not bundled: `src/speech.worker.ts` downloads `Xenova/whisper-base` from the
Hugging Face hub on first use and the browser keeps it cached.
- `efficientdet_lite2.tflite`: MediaPipe object detector (EfficientDet-Lite2, int8, COCO 80 classes), Apache-2.0, from
  https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/int8/latest/efficientdet_lite2.tflite
  (sha256 b3f50554cb0ea559e90328845f7d9ba4d13c8bff372914d24e06bc8bb72fa896). Used by `src/detect.ts`.
- `blaze_face_short_range.tflite`: MediaPipe face detector (BlazeFace short range, float16), Apache-2.0, from
  https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite
  (sha256 b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f). Used by `src/detect.ts`.
