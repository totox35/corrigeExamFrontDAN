import { Component, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef, Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlignImagesService } from '../services/align-images.service';
import { firstValueFrom } from 'rxjs';
import { CacheServiceImpl } from '../db/CacheServiceImpl';
import { QuestionService } from '../../entities/question/service/question.service';
import { IQuestion } from '../../entities/question/question.model';
import { IZone } from 'app/entities/zone/zone.model';
import { NgIf, NgFor } from '@angular/common';
import { PredictionService } from 'app/entities/prediction/service/prediction.service';
import { IPrediction } from 'app/entities/prediction/prediction.model';
import { MltComponent } from '../mlt/mlt.component';
import { CoupageDimageService } from '../mlt/coupage-dimage.service';
import { QueueCoordinationService } from './queue-coordination.service';

interface ExamPageImage {
  pageNumber: number;
  imageData: ImageData;
  width: number;
  height: number;
  questionId?: number;
  studentIndex: number;
  prediction?: string | undefined;
}

interface PredictionQueueItem {
  image: ExamPageImage;
  studentId: number;
  questionId?: number;
}

@Injectable()
@Component({
  selector: 'app-image-access',
  templateUrl: './image-access.component.html',
  standalone: true,
  imports: [NgIf, NgFor],
  providers: [MltComponent, CoupageDimageService],
})
export class ImageAccessComponent implements OnInit {
  @ViewChildren('imageCanvas') canvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  loading = true;
  error: string | null = null;
  examId: string | null = null;
  imageList: ExamPageImage[] = [];
  manuscriptQuestions: IQuestion[] = [];
  nbreFeuilleParCopie = 0;
  numberPagesInScan = 0;

  private predictionQueue: PredictionQueueItem[] = [];
  private processingCount = 0;
  private readonly MAX_CONCURRENT_PREDICTIONS = 1;
  private externalProcessing = false;

  constructor(
    private route: ActivatedRoute,
    private alignImagesService: AlignImagesService,
    private db: CacheServiceImpl,
    private questionService: QuestionService,
    private predictionService: PredictionService,
    private mltcomponent: MltComponent,
    private coupageDimageService: CoupageDimageService,
    private queueService: QueueCoordinationService,
  ) {
    this.queueService.externalProcessing$.subscribe(isPaused => (this.externalProcessing = isPaused));
  }

  async ngOnInit() {
    this.route.params.subscribe(async params => {
      this.examId = params['examid'];
      if (this.examId) {
        await this.loadManuscriptQuestions();
        await this.loadImages(this.examId);
      }
    });
  }

  async loadManuscriptQuestions() {
    try {
      const response = await firstValueFrom(this.questionService.query({ examId: +this.examId! }));
      this.manuscriptQuestions = response.body?.filter(q => q.typeAlgoName === 'manuscrit').sort((a, b) => a.numero! - b.numero!) || [];
      console.log('Found manuscript questions:', this.manuscriptQuestions);
    } catch (error) {
      console.error('Error loading manuscript questions:', error);
      this.error = 'Failed to load questions';
    }
  }
  async loadImages(exam_id: string) {
    try {
      this.loading = true;
      this.error = null;
      this.examId = exam_id;
      if (!this.examId) {
        throw new Error('No exam ID or no manuscript questions found');
      } else {
        await this.loadManuscriptQuestions();
      }
      if (this.manuscriptQuestions.length === 0) {
        throw new Error('no manuscript questions found');
      }

      // Get page counts
      this.nbreFeuilleParCopie = await this.db.countPageTemplate(+this.examId);
      this.numberPagesInScan = await this.db.countAlignImage(+this.examId);

      this.imageList = [];

      const totalStudents = Math.floor(this.numberPagesInScan / this.nbreFeuilleParCopie);

      //Reset the queue each new time
      this.predictionQueue = [];
      this.processingCount = 0;

      for (const question of this.manuscriptQuestions) {
        for (let studentIndex = 0; studentIndex < totalStudents; studentIndex++) {
          const zone = question.zoneDTO as IZone;
          if (!zone) continue;

          const pageForStudent = studentIndex * this.nbreFeuilleParCopie + zone.pageNumber!;

          const imageToCrop = {
            examId: +this.examId,
            factor: 1,
            align: true,
            template: false,
            indexDb: true,
            page: pageForStudent,
            z: zone,
          };

          try {
            const crop = await firstValueFrom(this.alignImagesService.imageCropFromZone(imageToCrop));

            const canvas = document.createElement('canvas');
            canvas.width = crop.width;
            canvas.height = crop.height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
              const imageData = new ImageData(new Uint8ClampedArray(crop.image), crop.width, crop.height);

              // Add image to list
              const newImage: ExamPageImage = {
                pageNumber: pageForStudent,
                imageData: imageData,
                width: crop.width,
                height: crop.height,
                questionId: question.id,
                studentIndex: studentIndex + 1,
              };

              this.imageList.push(newImage);

              // Add to prediction queue
              this.predictionQueue.push({
                image: newImage,
                studentId: studentIndex + 1,
                questionId: question.id,
              });

              // // Get or create prediction
              // await this.handlePrediction(newImage, studentIndex + 1);
            }
          } catch (error) {
            console.error(`Error processing question ${question.id} for student ${studentIndex + 1}:`, error);
          }
        }
      }

      // Start processing the queue
      await this.processQueue();

      this.loading = false;
    } catch (error) {
      console.error('Error:', error);
      this.error = 'Failed to load images';
      this.loading = false;
    }
  }

  private readonly THROTTLE_DELAY = 200; // Delay between predictions

  private async processQueue(): Promise<void> {
    while (this.predictionQueue.length > 0 || this.processingCount > 0) {
      const isProcessing = await firstValueFrom(this.queueService.externalProcessing$);

      if (isProcessing) {
        console.log(`Queue paused at ${new Date().toISOString()} - ${this.predictionQueue.length} items waiting`);
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      while (this.processingCount < this.MAX_CONCURRENT_PREDICTIONS && this.predictionQueue.length > 0) {
        const item = this.predictionQueue.shift();
        if (item) {
          this.processingCount++;
          console.log(
            `Processing prediction for student ${item.studentId}, question ${item.questionId}. Remaining in queue: ${this.predictionQueue.length}`,
          );

          try {
            await this.handlePrediction(item.image, item.studentId);
          } catch (error) {
            console.error('Error in prediction:', error);
          } finally {
            this.processingCount--;
            (item.image as any) = null;
            await new Promise(resolve => setTimeout(resolve, this.THROTTLE_DELAY));
            this.processQueue();
          }
        }
      }

      // Wait a bit before checking again if we can't process more items
      if (this.processingCount >= this.MAX_CONCURRENT_PREDICTIONS) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final cleanup
    this.predictionQueue = [];
    global.gc && global.gc();
  }

  private async handlePrediction(image: ExamPageImage, studentId: number) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      let ctx = canvas.getContext('2d');
      ctx?.putImageData(image.imageData, 0, 0);
      const base64Image = canvas.toDataURL();

      // Clear canvas reference
      canvas.width = 0;
      canvas.height = 0;
      (ctx as any) = null;

      // Query predictions for this question
      const predictionResponse = await firstValueFrom(this.predictionService.query({ questionId: image.questionId }));

      // Find prediction specific to this student
      const studentPrediction = predictionResponse.body?.find(pred => pred.studentId === studentId);

      if (studentPrediction) {
        image.prediction = studentPrediction.text || '';
      } else {
        // Create new prediction
        const predictionId = await this.createPrediction(image.questionId!, this.examId!, studentId, base64Image);

        if (predictionId) {
          // First use CoupageDimageService
          const coupageResponse = await firstValueFrom(this.coupageDimageService.runScript(base64Image));

          let prediction = '';

          if (coupageResponse.refinedLines && coupageResponse.refinedLines.length > 0) {
            try {
              // Convert refined lines to base64 format in one step
              const base64Lines = coupageResponse.refinedLines.map((line: any) => `data:image/png;base64,${line}`);

              // Send the whole batch to MLT at once
              const results = await this.mltcomponent.executeMLT(base64Lines);

              // Ensure results are correctly ordered and joined
              prediction = results!.join('\n');
            } catch (error) {
              console.error('Error processing refined lines in batch:', error);
            }

            // Clear refined lines after processing
            coupageResponse.refinedLines = [];
          }

          // Store and set prediction if we got any results
          if (prediction) {
            await this.storePrediction(prediction.trim(), image.questionId!, this.examId!, studentId, predictionId);
            image.prediction = prediction.trim();
          } else {
            image.prediction = 'No prediction available';
          }
        }
      }
      // Clear large data after processing
      if (image.imageData) {
        // @ts-ignore
        image.imageData = null;
      }
    } catch (error) {
      console.error('Error handling prediction:', error);
      image.prediction = 'No prediction available';
    }
  }

  private async createPrediction(questionId: number, examId: string, studentId: number, imageData: string): Promise<number | undefined> {
    const predictionData: IPrediction = {
      studentId: studentId,
      examId: examId,
      questionId: questionId,
      text: 'En attente',
      jsonData: '{"key": "value"}',
      zonegeneratedid: 'ZoneID123',
      imageData: imageData,
    };

    const response = await firstValueFrom(this.predictionService.create(predictionData));
    return response.body?.id;
  }

  private async storePrediction(prediction: string, questionId: number, examId: string, studentId: number, predictionId: number) {
    const predictionData: IPrediction = {
      id: predictionId,
      studentId: studentId,
      examId: examId,
      questionId: questionId,
      text: prediction,
      jsonData: '{"key": "value"}',
      zonegeneratedid: 'ZoneID123',
    };

    await firstValueFrom(this.predictionService.update(predictionData));
  }

  // private reviver(key: any, value: any): any {
  //   if (typeof value === 'object' && value !== null) {
  //     if (value.dataType === 'Map') {
  //       return new Map(value.value);
  //     }
  //   }
  //   return value;
  // }

  ngAfterViewInit() {
    this.canvases.changes.subscribe(() => {
      this.renderImages();
    });
  }

  private renderImages() {
    this.canvases.forEach((canvasRef, index) => {
      const imageInfo = this.imageList[index];
      if (imageInfo) {
        const canvas = canvasRef.nativeElement;
        const ctx = canvas.getContext('2d');

        canvas.width = imageInfo.width;
        canvas.height = imageInfo.height;
        ctx?.putImageData(imageInfo.imageData, 0, 0);
      }
    });
  }

  getUniqueStudents(): number[] {
    // Get unique student indices and sort them
    const students = [...new Set(this.imageList.map(img => img.studentIndex))];
    return students.sort((a, b) => a - b);
  }

  getImagesForStudent(studentIndex: number): ExamPageImage[] {
    // Get all images for a specific student
    return this.imageList.filter(img => img.studentIndex === studentIndex).sort((a, b) => (a.questionId || 0) - (b.questionId || 0)); // Sort by question ID
  }
}
