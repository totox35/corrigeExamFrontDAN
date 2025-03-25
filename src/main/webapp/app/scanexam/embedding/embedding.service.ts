import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class EmbeddingService {
  constructor(private http: HttpClient) {}

  initializeModel(): Observable<any> {
    return this.http.post('/api/initialize-model', {});
  }

  // Function to submit data to the backend for embedding
  submitDataForEmbedding(texts: string[]): Observable<Float32Array[]> {
    return this.http
      .post('/api/submit-data', { texts })
      .pipe(map((response: any) => response.embeddings.map((embedding: any) => new Float32Array(embedding))));
  }

  // Function for single text embedding
  executeEmbeddingFromText(text: string): Observable<Float32Array | undefined> {
    return this.submitDataForEmbedding([text]).pipe(map(embeddings => embeddings[0]));
  }
}
