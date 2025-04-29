// related-chunks.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';

export interface RelatedChunk {
  text?: string; // The chunk text content
  content?: string; // Alternative content field name
  pdf_name?: string; // Name of the PDF source
  page_number?: number; // Page number in the PDF
  score?: number; // Similarity score from Elasticsearch
  // Add any other fields returned by your API
}

export interface RelatedChunksResponse {
  status: string;
  message: string;
  output: string; // This contains the JSON string of chunks
  exitCode: number;
  warnings?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RelatedChunksService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  /**
   * Method 1: Get related chunks by passing text query (embedding generated on server)
   *
   * @param query - The search query text (will be embedded on the server)
   * @param courseName - The name of the course to search within
   * @param topN - Number of results to return (default: 5)
   * @returns Observable with parsed chunks
   */
  getRelatedChunksByText(query: string, courseName: string, topN: number = 5): Observable<RelatedChunk[]> {
    const body = { query, courseName, topN };
    return this.http.post<RelatedChunksResponse>(`${this.baseUrl}/get-related-chunks`, body).pipe(
      map(response => this.processResponse(response)),
      catchError(error => {
        console.error('Error fetching related chunks by text:', error);
        return throwError(() => new Error(error.message || 'An unknown error occurred'));
      }),
    );
  }

  /**
   * Method 2: Get related chunks by passing pre-calculated embedding
   *
   * @param embedding - The pre-calculated embedding vector
   * @param courseName - The name of the course to search within
   * @param topN - Number of results to return (default: 5)
   * @returns Observable with parsed chunks
   */
  getRelatedChunksByEmbedding(embedding: number[], courseName: string, topN: number = 5): Observable<RelatedChunk[]> {
    const body = { query: embedding, courseName, topN };
    return this.http.post<RelatedChunksResponse>(`${this.baseUrl}/get-related-chunks-by-embedding`, body).pipe(
      map(response => this.processResponse(response)),
      catchError(error => {
        console.error('Error fetching related chunks by embedding:', error);
        return throwError(() => new Error(error.message || 'An unknown error occurred'));
      }),
    );
  }

  /**
   * Process the API response and extract chunks
   */
  private processResponse(response: RelatedChunksResponse): RelatedChunk[] {
    if (response.status === 'success') {
      try {
        return response.output as unknown as RelatedChunk[];
      } catch (e) {
        console.error('Error parsing chunks response:', e);
        throw new Error('Failed to parse the chunks response');
      }
    } else {
      throw new Error(response.error || 'Failed to get related chunks');
    }
  }
}
