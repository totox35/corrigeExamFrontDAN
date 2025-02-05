import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PdfService {
  private resourceUrl = 'api';

  constructor(private http: HttpClient) {}

  addPdf(pdfTitle: string, pdfData: any, courseId: string): Observable<any> {
    const payload = {
      pdfName: pdfTitle, // PDF Name
      pdfData: pdfData.content, // Base64 content of the PDF
      courseName: courseId, // Course name
    };
    return this.http.post(this.resourceUrl + '/add-pdf', payload);
  }

  deleteChunks(pdfName?: string): Observable<any> {
    const payload = {
      pdfName: pdfName || '', // If pdfName is undefined or null, default to an empty string
    };
    return this.http.post(this.resourceUrl + '/delete-chunks', payload);
  }
}
