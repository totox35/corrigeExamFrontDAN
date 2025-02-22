import * as ort from 'onnxruntime-web';
import * as tf from '@tensorflow/tfjs';

type Tensor = tf.Tensor;

export const charList: string[] = [
  '<BLANK>',
  ' ',
  '!',
  '"',
  '#',
  '%',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  '-',
  '.',
  '/',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  ':',
  ';',
  '=',
  '?',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '_',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '{',
  '}',
  '¤',
  '°',
  '²',
  'À',
  'É',
  'à',
  'â',
  'ç',
  'è',
  'é',
  'ê',
  'ë',
  'î',
  'ô',
  'ù',
  'û',
  'œ',
  '€',
];

// Initialise ONNX Runtime (si une initialisation est requise)
export async function initializeOrt(): Promise<void> {
  try {
    ort.env.wasm.wasmPaths = '/public/';
    ort.env.wasm.numThreads = 1; // Set WebAssembly threads
    ort.env.wasm.proxy = false; // Disable proxy if not required
    //console.log('ONNX Runtime initialized');
  } catch (error) {
    console.error('Error initializing ONNX Runtime:', error);
  }
}

/**
 * Charge une image à partir d'une URL ou d'une chaîne base64 à l'aide de createImageBitmap.
 * Cela fonctionne dans un contexte de Worker.
 * @param url Chaîne représentant une URL ou une chaîne base64
 * @returns Un objet ImageBitmap
 */
export async function loadImage(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  const blob = await response.blob();
  return await createImageBitmap(blob);
}

/**
 * Prétraite une image pour l'inférence du modèle.
 * @param imageSource Blob contenant les données de l'image
 * @param channelNb Nombre de canaux (1 pour monochrome, 3 pour RGB)
 * @param padValue Valeur de remplissage
 * @param padWidthRight Largeur de remplissage à droite
 * @param padWidthLeft Largeur de remplissage à gauche
 * @param mean Moyenne pour la normalisation
 * @param std Écart-type pour la normalisation
 * @param targetHeight Hauteur cible pour la mise à l'échelle
 * @returns Tenseur de l'image prétraitée
 */
export async function preprocessImage(
  imageSource: Blob,
  channelNb: number,
  padValue: number,
  padWidthRight: number,
  padWidthLeft: number,
  mean: number,
  std: number,
  targetHeight: number,
): Promise<Tensor> {
  // Crée une image bitmap depuis le blob
  const imageBitmap = await createImageBitmap(imageSource);

  // Convertit l'image en tenseur à l'aide de TensorFlow.js
  const tensor = tf.browser.fromPixels(imageBitmap);

  // Convertit en monochrome si nécessaire
  let processedImage = tensor;
  if (channelNb === 1 && tensor.shape[2] !== undefined && tensor.shape[2] > 1) {
    processedImage = tf.mean(tensor, -1, true);
  }

  // Mise à l'échelle de l'image à la hauteur cible
  const aspectRatio = (tensor.shape[1] ?? 1) / (tensor.shape[0] ?? 1);
  const newWidth = Math.round(targetHeight * aspectRatio);
  processedImage = tf.image.resizeBilinear(processedImage as tf.Tensor3D, [targetHeight, newWidth]);

  // Normalisation
  processedImage = processedImage.div(tf.scalar(255.0));
  processedImage = processedImage.sub(tf.scalar(mean)).div(tf.scalar(std));

  // Ajout de padding pour l'image redimensionnée
  const padLeft = tf.pad(
    processedImage,
    [
      [0, 0],
      [padWidthLeft, 0],
      [0, 0],
    ],
    padValue,
  );
  const paddedImage = tf.pad(
    padLeft,
    [
      [0, 0],
      [0, padWidthRight],
      [0, 0],
    ],
    padValue,
  );

  // Ajoute une dimension batch pour l'inférence
  const batchedImage = paddedImage.expandDims(0);

  // Vérifiez les dimensions avant d'ajouter une dimension channel
  //console.log('Dimensions avant ajout de la dimension channel:', batchedImage.shape);

  // Ajoute une dimension channel si nécessaire
  let finalImage = batchedImage;
  if (batchedImage.shape.length === 3) {
    finalImage = batchedImage.expandDims(-1);
  }
  //console.log('Dimensions après ajout de la dimension channel:', finalImage.shape);

  return finalImage;
}

/**
 * Exécute une inférence sur un modèle ONNX.
 * @param imageTensor Tenseur d'entrée (prétraité)
 * @param modelPath Chemin vers le fichier du modèle ONNX
 * @returns Résultat de l'inférence sous forme de chaîne
 */
export async function runInference(imageTensor: Tensor, modelPath: string): Promise<string> {
  // Charge le modèle ONNX
  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['wasm'],
  });

  // Prépare l'entrée pour le modèle ONNX
  //console.log('Dimensions avant expandDims:', imageTensor.shape);

  // Ajoute une dimension batch si nécessaire
  let inputImage = imageTensor;
  if (inputImage.shape.length === 3) {
    inputImage = inputImage.expandDims(0);
  }
  //console.log('Dimensions après expandDims:', inputImage.shape);

  // Vérifiez que le tenseur a 4 dimensions avant d'appeler transpose
  if (inputImage.shape.length !== 4) {
    throw new Error(`Le tenseur d'entrée doit avoir 4 dimensions, mais en a ${inputImage.shape.length}`);
  }

  const transposedImage = inputImage.transpose([0, 3, 1, 2]);
  //console.log('Dimensions après transpose:', transposedImage.shape);

  const imageWidth = tf.scalar(transposedImage.shape[3] ?? 0, 'int32');

  const inputImageONNX = new ort.Tensor('float32', await transposedImage.data(), transposedImage.shape);
  const imageWidthONNX = new ort.Tensor('int32', await imageWidth.dataSync());

  const feeds = {
    inputs: inputImageONNX, // Assurez-vous que le nom 'inputs' correspond au nom attendu par le modèle ONNX
    image_widths: imageWidthONNX,
  };

  const results = await session.run(feeds);

  const probabilitiesTensor = results.output;
  const probabilities1D: number[] = Array.from(probabilitiesTensor.data as Float32Array);
  const batchSize = probabilitiesTensor.dims[0];
  const numFrames = probabilitiesTensor.dims[1];
  const numChars = probabilitiesTensor.dims[2];

  const reshapedProbabilities: number[][][] = [];
  let offset = 0;
  for (let b = 0; b < batchSize; b++) {
    const batchFrames: number[][] = [];
    for (let i = 0; i < numFrames; i++) {
      batchFrames.push(probabilities1D.slice(offset, offset + numChars));
      offset += numChars;
    }
    reshapedProbabilities.push(batchFrames);
  }

  const decodedBatch = reshapedProbabilities.map(probabilities => bestPathDecoding(probabilities, charList, -1, 0, true));
  return decodedBatch.join(', ');
}
/**
 * Décodage par chemin optimal (best-path decoding).
 * Appliqué sur un ensemble de probabilités.
 * @param probabilities Tableau 2D des probabilités
 * @param charList Liste des caractères possibles
 * @returns Chaîne décodée
 */
export function bestPathDecoding(
  probabilities: number[][],
  charList: string[],
  maxLen: number,
  blankIndex: number,
  removeDuplicates = true,
): string {
  maxLen = maxLen === -1 ? probabilities.length : Math.min(maxLen, probabilities.length);

  const sequenceRaw = probabilities.slice(0, maxLen).map(frame => frame.indexOf(Math.max(...frame)));
  let processedSequence: number[] = [];

  if (removeDuplicates) {
    let previousChar: number | null = null;
    for (const char of sequenceRaw) {
      if (char !== previousChar && char !== blankIndex) {
        processedSequence.push(char);
      }
      previousChar = char;
    }
  } else {
    processedSequence = sequenceRaw;
  }

  return convertIntToChars(processedSequence, charList);
}

export function convertIntToChars(sequence: number[], charList: string[]): string {
  return sequence.map(index => charList[index]).join('');
}
