import { Component, OnInit, ViewChildren, QueryList, ElementRef, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIf, NgFor, CommonModule } from '@angular/common';
import { QueueCoordinationService } from './queue-coordination.service';
import { PredictionHandlerService } from './prediction-handler.service';

interface ExamPageImage {
  pageNumber: number;
  imageData: ImageData;
  width: number;
  height: number;
  questionId?: number;
  studentIndex: number;
  prediction?: string | undefined;
}
@Component({
  selector: 'app-image-access',
  templateUrl: './image-access.component.html',
  standalone: true,
  imports: [NgFor, NgIf, CommonModule],
})
export class ImageAccessComponent implements OnInit {
  @ViewChildren('imageCanvas') canvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  examId: string | null = null;
  imageList: ExamPageImage[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    @Inject(PredictionHandlerService) private predictionHandler: PredictionHandlerService,
    private queueService: QueueCoordinationService,
  ) {
    console.log('Constructor called');
    this.queueService.externalProcessing$.subscribe(isPaused => {
      console.log('Queue processing status changed:', isPaused);
    });
  }

  async ngOnInit(): Promise<void> {
    console.log('ngOnInit called');
    this.route.params.subscribe(async params => {
      this.examId = params['examid'];
      if (this.examId) {
        try {
          this.loading = true;
          this.imageList = await this.predictionHandler.handlePredictions(this.examId);
        } catch (error) {
          console.error('Error handling predictions:', error);
          this.error = 'Failed to process predictions';
        } finally {
          this.loading = false;
        }
      }
    });
  }

  getUniqueStudents(): number[] {
    const students = [...new Set(this.imageList.map(img => img.studentIndex))];
    return students.sort((a, b) => a - b);
  }

  getImagesForStudent(studentIndex: number): ExamPageImage[] {
    return this.imageList.filter(img => img.studentIndex === studentIndex).sort((a, b) => (a.questionId || 0) - (b.questionId || 0));
  }

  ngAfterViewInit(): void {
    this.canvases.changes.subscribe(() => {
      this.renderImages();
    });
  }

  private renderImages(): void {
    this.canvases.forEach((canvasRef, index) => {
      const imageInfo = this.imageList[index];
      if (imageInfo) {
        const canvas = canvasRef.nativeElement;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = imageInfo.width;
          canvas.height = imageInfo.height;
          ctx.putImageData(imageInfo.imageData, 0, 0);
        }
      }
    });
  }
}
