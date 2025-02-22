import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlignImagesService } from '../services/align-images.service';
import { CacheServiceImpl } from '../db/CacheServiceImpl';
import { QuestionService } from '../../entities/question/service/question.service';
import { IQuestion } from '../../entities/question/question.model';
import { IZone } from 'app/entities/zone/zone.model';
import { QueueCoordinationService } from './queue-coordination.service';
import { AuthServerProvider } from '../../core/auth/auth-jwt.service';

interface ExamPageImage {
  pageNumber: number;
  imageData: ImageData;
  width: number;
  height: number;
  questionId?: number;
  studentIndex: number;
  prediction?: string | undefined;
}

@Injectable({
  providedIn: 'root',
})
export class PredictionHandlerService {
  private predictionWorker: Worker | undefined;
  private imageList: ExamPageImage[] = [];
  private manuscriptQuestions: IQuestion[] = [];
  private nbreFeuilleParCopie = 0;
  private numberPagesInScan = 0;

  constructor(
    private alignImagesService: AlignImagesService,
    private db: CacheServiceImpl,
    private questionService: QuestionService,
    private authServerProvider: AuthServerProvider,
    private queueService: QueueCoordinationService,
  ) {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    if (typeof Worker !== 'undefined') {
      try {
        this.predictionWorker = new Worker(new URL('../image-access/prediction_worker', import.meta.url));
        this.predictionWorker.onmessage = ({ data }) => {
          const { studentId, questionId, prediction } = data;
          console.log(`Prédiction reçue pour étudiant ${studentId}, question ${questionId}: ${prediction}`);
          const image = this.imageList.find(img => img.studentIndex === studentId && img.questionId === questionId);
          if (image) {
            image.prediction = prediction;
          }
        };
      } catch (error) {
        console.error('Error initializing worker:', error);
        this.predictionWorker = undefined;
      }
    }
  }

  async handlePredictions(examId: string): Promise<ExamPageImage[]> {
    console.log('Starting predictions for exam:', examId);
    await this.loadManuscriptQuestions(examId);
    await this.loadImages(examId);
    return this.imageList;
  }

  private async loadManuscriptQuestions(examId: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.questionService.query({ examId: +examId }));
      this.manuscriptQuestions = response.body?.filter(q => q.typeAlgoName === 'manuscrit').sort((a, b) => a.numero! - b.numero!) || [];
      console.log('Found manuscript questions:', this.manuscriptQuestions);
    } catch (error) {
      console.error('Error loading manuscript questions:', error);
      throw error;
    }
  }

  private async loadImages(examId: string): Promise<void> {
    try {
      console.log('Loading images for exam ID:', examId);
      this.imageList = [];

      this.nbreFeuilleParCopie = await this.db.countPageTemplate(+examId);
      this.numberPagesInScan = await this.db.countAlignImage(+examId);
      const totalStudents = Math.floor(this.numberPagesInScan / this.nbreFeuilleParCopie);

      for (const question of this.manuscriptQuestions) {
        for (let studentIndex = 0; studentIndex < totalStudents; studentIndex++) {
          const zone = question.zoneDTO as IZone;
          if (!zone) continue;

          const pageForStudent = studentIndex * this.nbreFeuilleParCopie + zone.pageNumber!;
          await this.processImageForStudent(examId, zone, pageForStudent, studentIndex, question.id!);
        }
      }
    } catch (error) {
      console.error('Error loading images:', error);
      throw error;
    }
  }

  private async processImageForStudent(
    examId: string,
    zone: IZone,
    pageForStudent: number,
    studentIndex: number,
    questionId: number,
  ): Promise<void> {
    try {
      const imageToCrop = {
        examId: +examId,
        factor: 1,
        align: true,
        template: false,
        indexDb: true,
        page: pageForStudent,
        z: zone,
      };

      const crop = await firstValueFrom(this.alignImagesService.imageCropFromZone(imageToCrop));
      const imageData = new ImageData(new Uint8ClampedArray(crop.image), crop.width, crop.height);

      const newImage: ExamPageImage = {
        pageNumber: pageForStudent,
        imageData,
        width: crop.width,
        height: crop.height,
        questionId,
        studentIndex: studentIndex + 1,
      };

      this.imageList.push(newImage);

      const token = this.authServerProvider.getToken();
      if (!this.predictionWorker || !token) {
        console.error('Worker or token not available');
        return;
      }

      this.predictionWorker.postMessage({
        examPageImage: newImage,
        examId,
        authToken: token,
      });
    } catch (error) {
      console.error(`Error processing image for student ${studentIndex + 1}:`, error);
    }
  }
}
