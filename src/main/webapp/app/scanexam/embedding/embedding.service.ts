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
  submitDataForEmbedding(texts: string[]): Observable<number[][]> {
    return this.http
      .post('/api/submit-data', { texts })
      .pipe(map((response: any) => response.embeddings.map((embedding: any) => embedding.embedding)));
  }

  // Function for single text embedding
  executeEmbeddingFromText(text: string): Observable<number[] | undefined> {
    return this.submitDataForEmbedding([text]).pipe(map(embeddings => embeddings[0]));
  }
}
