import { Component, OnInit, ViewChildren, ElementRef, QueryList } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlignImagesService } from '../services/align-images.service';
import { firstValueFrom } from 'rxjs';
import { CacheServiceImpl } from '../db/CacheServiceImpl';
import { QuestionService } from '../../entities/question/service/question.service';
import { IQuestion } from '../../entities/question/question.model';
import { IZone } from 'app/entities/zone/zone.model';
import { NgIf, NgFor } from '@angular/common';
import { ScriptService } from 'app/entities/scan/service/dan-service.service';
import { PredictionService } from 'app/entities/prediction/service/prediction.service';
import { IPrediction } from 'app/entities/prediction/prediction.model';
import { MltComponent } from '../mlt/mlt.component';
import { CoupageDimageService } from '../mlt/coupage-dimage.service';
import { QueueCoordinationService } from './queue-coordination.service';
import { AuthServerProvider } from 'app/core/auth/auth-jwt.service';

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

interface PredictionTask {
  examPageImage: ExamPageImage;
  examId: string;
  authToken?: string; // transmis depuis le main thread
}

@Component({
  selector: 'app-image-access',
  templateUrl: './image-access.component.html',
})
export class ImageAccessComponent implements OnInit {
  @ViewChildren('imageCanvas') canvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  examId: string | null = null;
  imageList: ExamPageImage[] = [];
  manuscriptQuestions: IQuestion[] = [];
  nbreFeuilleParCopie = 0;
  numberPagesInScan = 0;
  loading = true;
  error: string | null = null;

  private predictionQueue: PredictionQueueItem[] = [];
  private processingCount = 0;
  private readonly MAX_CONCURRENT_PREDICTIONS = 1;
  private readonly THROTTLE_DELAY = 200; // ms

  private predictionWorker: Worker | undefined;

  private compteur = 0;

  constructor(
    private route: ActivatedRoute,
    private alignImagesService: AlignImagesService,
    private db: CacheServiceImpl,
    private questionService: QuestionService,
    private scriptService: ScriptService,
    private predictionService: PredictionService,
    private mltcomponent: MltComponent,
    private coupageDimageService: CoupageDimageService,
    private queueService: QueueCoordinationService,
    private authServerProvider: AuthServerProvider,
  ) {
    this.ngOnInit();
  }

  async ngOnInit(): Promise<void> {
    console.log('ngOnInit called');
    if (typeof Worker !== 'undefined') {
      try {
        console.log('Initializing worker');
        this.predictionWorker = new Worker(new URL('./prediction_worker', import.meta.url));
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
    } else {
      console.error('Web Workers are not supported in this environment.');
    }

    this.route.params.subscribe(async params => {
      this.examId = params['examid'];
      console.log('Exam ID:', this.examId);
      if (this.examId) {
        await this.loadManuscriptQuestions();
        await this.loadImages(this.examId);
      }
    });
  }

  async loadManuscriptQuestions(): Promise<void> {
    try {
      console.log('Loading manuscript questions');
      const response = await firstValueFrom(this.questionService.query({ examId: +this.examId! }));
      this.manuscriptQuestions = response.body?.filter(q => q.typeAlgoName === 'manuscrit').sort((a, b) => a.numero! - b.numero!) || [];
      console.log('Found manuscript questions:', this.manuscriptQuestions);
    } catch (error) {
      console.error('Error loading manuscript questions:', error);
      this.error = 'Failed to load questions';
    }
  }

  async loadImages(examId: string): Promise<void> {
    try {
      console.log('Loading images for exam ID:', examId);
      this.loading = true;
      this.imageList = [];
      this.predictionQueue = [];
      this.nbreFeuilleParCopie = await this.db.countPageTemplate(+this.examId!);
      this.numberPagesInScan = await this.db.countAlignImage(+this.examId!);
      const totalStudents = Math.floor(this.numberPagesInScan / this.nbreFeuilleParCopie);
      for (const question of this.manuscriptQuestions) {
        for (let studentIndex = 0; studentIndex < totalStudents; studentIndex++) {
          const zone = question.zoneDTO as IZone;
          if (!zone) continue;
          const pageForStudent = studentIndex * this.nbreFeuilleParCopie + zone.pageNumber!;
          const imageToCrop = {
            examId: +this.examId!,
            factor: 1,
            align: true,
            template: false,
            indexDb: true,
            page: pageForStudent,
            z: zone,
          };
          try {
            const crop = await firstValueFrom(this.alignImagesService.imageCropFromZone(imageToCrop));
            const canvas = new OffscreenCanvas(crop.width, crop.height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const imageData = new ImageData(new Uint8ClampedArray(crop.image), crop.width, crop.height);
              const newImage: ExamPageImage = {
                pageNumber: pageForStudent,
                imageData: imageData,
                width: crop.width,
                height: crop.height,
                questionId: question.id,
                studentIndex: studentIndex + 1,
              };
              this.imageList.push(newImage);
              this.predictionQueue.push({
                image: newImage,
                studentId: studentIndex + 1,
                questionId: question.id,
              });
            }
          } catch (error) {
            console.error(`Error processing question ${question.id} for student ${studentIndex + 1}:`, error);
          }
        }
      }
      await this.processQueue();
      this.loading = false;
    } catch (error) {
      console.error('Error loading images:', error);
      this.error = 'Failed to load images';
      this.loading = false;
    }
  }

  private async handlePredictionInWorker(item: PredictionQueueItem): Promise<void> {
    if (!this.predictionWorker) {
      console.error('Worker not available');
      return;
    }
    const token = this.authServerProvider.getToken();
    if (!token) {
      console.error('Token not found');
      return;
    }
    console.log(`Sending prediction to worker for student: ${item.studentId} question: ${item.questionId}, token: ${token}`);
    const task: PredictionTask = {
      examPageImage: item.image,
      examId: this.examId!,
      authToken: token,
    };
    this.predictionWorker.postMessage(task);
  }

  private async processQueue(): Promise<void> {
    console.log('Processing prediction queue');
    while (this.predictionQueue.length > 0) {
      const item = this.predictionQueue.shift();
      this.compteur++;
      if (item) {
        await this.handlePredictionInWorker(item);
        await new Promise(resolve => setTimeout(resolve, this.THROTTLE_DELAY));
      }
    }
    console.log('Nombre de shift : ' + this.compteur);
  }
}
