import { Component, OnInit } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { UntypedFormBuilder, UntypedFormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { IPrediction, Prediction } from '../prediction.model';
import { PredictionService } from '../service/prediction.service';
import { IQuestion } from 'app/entities/question/question.model';
import { QuestionService } from 'app/entities/question/service/question.service';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { NgFor } from '@angular/common';
import { AlertErrorComponent } from '../../../shared/alert/alert-error.component';
import { TranslateDirective } from '../../../shared/language/translate.directive';

@Component({
  selector: 'jhi-prediction-update',
  templateUrl: './prediction-update.component.html',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslateDirective, AlertErrorComponent, NgFor, FaIconComponent],
})
export class PredictionUpdateComponent implements OnInit {
  isSaving = false;
  questions: IQuestion[] = [];
  editForm: UntypedFormGroup;

  constructor(
    protected predictionService: PredictionService,
    protected questionService: QuestionService,
    protected activatedRoute: ActivatedRoute,
    protected fb: UntypedFormBuilder,
  ) {
    this.editForm = this.fb.group({
      id: [],
      text: [],
      questionId: [],
      sheetId: [],
      questionNumber: [],
    });
  }

  ngOnInit(): void {
    this.activatedRoute.data.subscribe(({ prediction }) => {
      this.updateForm(prediction);
      this.questionService.query().subscribe((res: HttpResponse<IQuestion[]>) => (this.questions = res.body || []));
    });
  }

  previousState(): void {
    window.history.back();
  }

  save(): void {
    this.isSaving = true;
    const prediction = this.createFromForm();
    if (prediction.id !== undefined) {
      this.subscribeToSaveResponse(this.predictionService.update(prediction));
    } else {
      this.subscribeToSaveResponse(this.predictionService.create(prediction));
    }
  }

  trackById(index: number, item: IQuestion): any {
    return item.id;
  }

  protected subscribeToSaveResponse(result: Observable<HttpResponse<IPrediction>>): void {
    result.pipe(finalize(() => this.onSaveFinalize())).subscribe({
      next: () => this.onSaveSuccess(),
      error: () => this.onSaveError(),
    });
  }

  protected onSaveSuccess(): void {
    this.previousState();
  }

  protected onSaveError(): void {
    // Api for inheritance.
  }

  protected onSaveFinalize(): void {
    this.isSaving = false;
  }

  protected updateForm(prediction: IPrediction): void {
    this.editForm.patchValue({
      id: prediction.id,
      text: prediction.text,
      questionId: prediction.questionId,
      sheetId: prediction.sheetId,
      questionNumber: prediction.questionNumber,
    });
  }

  protected createFromForm(): IPrediction {
    return {
      ...new Prediction(),
      id: this.editForm.get(['id'])!.value,
      text: this.editForm.get(['text'])!.value,
      questionId: this.editForm.get(['questionId'])!.value,
      sheetId: this.editForm.get(['sheetId'])!.value,
      questionNumber: this.editForm.get(['questionNumber'])!.value,
    };
  }
}
