// Real-world objects and faces in a picture, on the device: MediaPipe's object detector (EfficientDet-Lite2, 80 everyday
// kinds, 7.5 MB) and face detector (BlazeFace, 230 KB) ship with the app. Used when reading a reference thumbnail.
import { FaceDetector, ObjectDetector } from '@mediapipe/tasks-vision';
import loaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import objectModel from './models/efficientdet_lite2.tflite?url';
import faceModel from './models/blaze_face_short_range.tflite?url';
import type { Box } from './layout.ts';

type Source = ImageBitmap | OffscreenCanvas | HTMLCanvasElement;
const files = { wasmLoaderPath: loaderUrl, wasmBinaryPath: wasmUrl };
let objects: Promise<ObjectDetector> | null = null;
let faces: Promise<FaceDetector> | null = null;

const retry = <T,>(p: Promise<T>, reset: () => void) => p.catch((e) => { reset(); throw e; });

export function detectObjects(img: Source, w: number, h: number): Promise<(Box & { label: string; score: number })[]> {
  objects ??= retry(ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: objectModel, delegate: 'CPU' }, runningMode: 'IMAGE', scoreThreshold: 0.3, maxResults: 25 }), () => (objects = null));
  return objects.then((d) =>
    d.detect(img).detections.flatMap((x) => {
      const b = x.boundingBox;
      const c = x.categories[0];
      return b && c ? [{ cx: (b.originX + b.width / 2) / w, cy: (b.originY + b.height / 2) / h, w: b.width / w, h: b.height / h, label: c.categoryName, score: c.score }] : [];
    }),
  );
}

export function detectFaces(img: Source, w: number, h: number): Promise<Box[]> {
  faces ??= retry(FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: faceModel, delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: 0.5 }), () => (faces = null));
  return faces.then((d) => d.detect(img).detections.flatMap((x) => (x.boundingBox ? [{ cx: (x.boundingBox.originX + x.boundingBox.width / 2) / w, cy: (x.boundingBox.originY + x.boundingBox.height / 2) / h, w: x.boundingBox.width / w, h: x.boundingBox.height / h }] : [])));
}

// Names for the layer list; anything else keeps the detector's English word.
const THAI: Record<string, string> = {
  person: 'คน', cup: 'แก้ว', bottle: 'ขวด', 'cell phone': 'มือถือ', laptop: 'โน้ตบุ๊ก', car: 'รถ', motorcycle: 'มอเตอร์ไซค์', bicycle: 'จักรยาน',
  dog: 'สุนัข', cat: 'แมว', bird: 'นก', book: 'หนังสือ', clock: 'นาฬิกา', chair: 'เก้าอี้', couch: 'โซฟา', tv: 'ทีวี', bowl: 'ชาม',
  pizza: 'พิซซ่า', cake: 'เค้ก', donut: 'โดนัท', sandwich: 'แซนด์วิช', banana: 'กล้วย', apple: 'แอปเปิล', orange: 'ส้ม', handbag: 'กระเป๋า',
  backpack: 'เป้', umbrella: 'ร่ม', 'sports ball': 'ลูกบอล', keyboard: 'คีย์บอร์ด', mouse: 'เมาส์', 'potted plant': 'ต้นไม้', vase: 'แจกัน',
  'dining table': 'โต๊ะ', bed: 'เตียง', knife: 'มีด', fork: 'ส้อม', spoon: 'ช้อน', 'wine glass': 'แก้วไวน์', teddy: 'ตุ๊กตา', 'teddy bear': 'ตุ๊กตา',
};
// A low-scored guess is often a near miss (a burger read as a teddy bear): the place is right, the name is not shown.
export const thaiLabel = (label?: string, score = 1) => (label && score >= 0.55 ? THAI[label] ?? label : 'วัตถุ');
