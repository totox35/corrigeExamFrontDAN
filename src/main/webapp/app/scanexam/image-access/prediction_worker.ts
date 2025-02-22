/// <reference lib="webworker" />

import { initializeOrt, preprocessImage, runInference, charList } from '../mlt/mlt-utils';
import { QueueCoordinationService } from './queue-coordination.service';

interface ExamPageImage {
  pageNumber: number;
  imageData: ImageData;
  width: number;
  height: number;
  questionId?: number;
  studentIndex: number;
  prediction?: string;
}

interface PredictionTask {
  examPageImage: ExamPageImage;
  examId: string;
  authToken?: string; // transmis depuis le main thread
}

interface PredictionResult {
  studentId: number;
  questionId: number;
  prediction: string;
}

// Convertit l'image (ImageData) en une chaîne base64 à l'aide d'OffscreenCanvas
async function convertImageDataToBase64(imageData: ImageData): Promise<string> {
  const offscreen = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error("Impossible de récupérer le contexte 2D d'OffscreenCanvas");
  ctx.putImageData(imageData, 0, 0);
  const blob = await offscreen.convertToBlob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Vérifie si une prédiction existe déjà pour la question et l'étudiant
async function getPrediction(questionId: number, studentId: number, authToken?: string): Promise<string | null> {
  const response = await fetch(`/api/predictions?questionId=${questionId}&studentId=${studentId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Erreur lors de la récupération des prédictions');
  const data = await response.json();
  const pred = data.find((p: any) => p.studentId === studentId);
  return pred ? pred.text : null;
}

// Crée une nouvelle prédiction
async function createPrediction(task: PredictionTask, base64Image: string): Promise<number> {
  const examPageImage = task.examPageImage;
  const payload = {
    studentId: examPageImage.studentIndex,
    examId: task.examId,
    questionId: examPageImage.questionId,
    text: 'En attente',
    jsonData: '{"key": "value"}',
    zonegeneratedid: 'ZoneID123',
    imageData: base64Image,
  };
  const response = await fetch('/api/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(task.authToken ? { Authorization: `Bearer ${task.authToken}` } : {}),
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Erreur lors de la création de la prédiction');
  const data = await response.json();
  return data.id;
}

// Exécute le coupage (découpage de l'image)
// Ici, on retire le préfixe "data:image/png;base64," pour envoyer uniquement la partie pure
async function runCoupage(base64Image: string, authToken?: string): Promise<string[]> {
  const pureBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const body = { image: pureBase64 }; // Utiliser la clé "image" comme dans le service initial

  console.log('Sending image for coupage:', body);

  const response = await fetch('/api/coupage-dimage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response from coupage:', errorText);
    throw new Error(`Erreur lors du coupage: ${errorText}`);
  }
  const data = await response.json();
  console.log('Coupage response data:', data);
  return data.refinedLines || [];
}

// Exécute le modèle MLT sur une ligne d'image
async function executeMLT(base64Line: string, authToken?: string): Promise<string | undefined> {
  await initializeOrt();
  const channelNb: number = 1; // Monochrome
  const padValue: number = 0.0;
  const padWidthRight: number = 64;
  const padWidthLeft: number = 64;
  const mean: number = 238.6531 / 255;
  const std: number = 43.4356 / 255;
  const targetHeight: number = 128;

  try {
    const response = await fetch(base64Line);
    const blob = await response.blob();
    const preprocessedImage = await preprocessImage(blob, channelNb, padValue, padWidthRight, padWidthLeft, mean, std, targetHeight);
    const modelPath: string = '../../content/classifier/trace_mlt-4modern_hw_rimes_lines-v3+synth-1034184_best_encoder.tar.onnx';
    const prediction = await runInference(preprocessedImage, modelPath);

    console.log('Prediction:', prediction);
    return prediction;
  } catch (error) {
    console.error('Error in executeMLT:', error);
    return undefined;
  }
}

// Met à jour la prédiction dans le backend
async function updatePrediction(predictionId: number, predictionText: string, task: PredictionTask): Promise<void> {
  const examPageImage = task.examPageImage;
  const payload = {
    id: predictionId,
    studentId: examPageImage.studentIndex,
    examId: task.examId,
    questionId: examPageImage.questionId,
    text: predictionText,
    jsonData: '{"key": "value"}',
    zonegeneratedid: 'ZoneID123',
  };
  const response = await fetch('/api/predictions', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(task.authToken ? { Authorization: `Bearer ${task.authToken}` } : {}),
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Erreur lors de la mise à jour de la prédiction');
}

self.onmessage = async (event: MessageEvent<PredictionTask>) => {
  const task = event.data;
  const examPageImage = task.examPageImage;
  console.log('Worker received task for student:', examPageImage.studentIndex, 'question:', examPageImage.questionId);
  try {
    const base64Image = await convertImageDataToBase64(examPageImage.imageData);
    let prediction = await getPrediction(examPageImage.questionId!, examPageImage.studentIndex, task.authToken);
    if (prediction) {
      console.log('Prediction exists:', prediction);
      self.postMessage({ studentId: examPageImage.studentIndex, questionId: examPageImage.questionId, prediction });
      return;
    }
    const predictionId = await createPrediction(task, base64Image);
    console.log('Created prediction with ID:', predictionId);
    const refinedLines = await runCoupage(base64Image, task.authToken);
    let predictionText = '';
    if (refinedLines.length > 0) {
      for (const refinedLine of refinedLines) {
        const base64Line = 'data:image/png;base64,' + refinedLine;
        const lineResult = await executeMLT(base64Line, task.authToken);
        if (lineResult) {
          predictionText += lineResult + '\n';
        }
      }
      predictionText = predictionText.trim();
      await updatePrediction(predictionId, predictionText, task);
    } else {
      predictionText = 'No prediction available';
      await updatePrediction(predictionId, predictionText, task);
    }
    self.postMessage({ studentId: examPageImage.studentIndex, questionId: examPageImage.questionId, prediction: predictionText });
  } catch (error) {
    console.error('Error in worker:', error);
    self.postMessage({ studentId: examPageImage.studentIndex, questionId: examPageImage.questionId, prediction: 'Erreur de prédiction' });
  }
};
