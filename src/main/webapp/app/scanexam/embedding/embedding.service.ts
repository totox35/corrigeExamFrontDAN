/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as ort from 'onnxruntime-web';
import { Injectable } from '@angular/core';
import { InferenceSession } from 'onnxruntime-web';

// Optionnel: Vérifie la compatibilité WASM
ort.env.wasm.wasmPaths = '/public/';

@Injectable({
  providedIn: 'root',
})
export class EmbeddingService {
  session: InferenceSession | undefined = undefined;

  constructor() {}

  async initializeOrt() {
    try {
      ort.env.wasm.numThreads = 1; // Set WebAssembly threads
      ort.env.wasm.proxy = false; // Disable proxy if not required
    } catch (error) {
      console.error('Error configuring ONNX Runtime:', error);
    }
  }

  // Function to preprocess text input
  preprocessText(text: string): any {
    // TO DO (Optional) : Implement necessary text preprocessing
    return text;
  }

  // Function to perform inference with the ONNX model
  async runInference(text: string, modelPath: string): Promise<Float32Array> {
    try {
      if (this.session === undefined) {
        this.session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['wasm'],
        });
      }

      // Preprocess the text input
      const preprocessedText = this.preprocessText(text);

      // Create a tensor from preprocessed text
      const inputTensor = new ort.Tensor('string', [preprocessedText]);

      // Run inference
      const results = await this.session.run({ inputs: inputTensor });

      // Extract embeddings from results
      // From what I've gathered in the documentation on HuggingFace, it gives back Float32 numbers
      const embeddings = results.output.data as Float32Array;

      // eslint-disable-next-line no-console
      console.log(embeddings); // Temporary Debugging

      return embeddings;
    } catch (error) {
      console.error('Error during inference:', error);
      return new Float32Array();
    }
  }

  async executeEmbeddingFromText(text: string): Promise<Float32Array | undefined> {
    this.initializeOrt();

    try {
      const modelPath: string = '../../content/embedding/jina-embeddings-v3.onnx';

      // Perform inference to get embeddings
      const embeddings = await this.runInference(text, modelPath);

      return embeddings;
    } catch (error) {
      console.error('Error in executeEmbeddingFromText:', error);
      return undefined;
    }
  }
}
