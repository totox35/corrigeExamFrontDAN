// response-group-update.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { UntypedFormBuilder, UntypedFormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { IResponseGroup, ResponseGroup } from '../response-group.model';
import { ResponseGroupService } from '../service/response-group.service.component';
import { IQuestion } from 'app/entities/question/question.model';
import { QuestionService } from 'app/entities/question/service/question.service';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { NgFor, NgIf } from '@angular/common';
import { AlertErrorComponent } from '../../../shared/alert/alert-error.component';
import { TranslateDirective } from '../../../shared/language/translate.directive';

@Component({
  selector: 'jhi-response-group-update',
  templateUrl: './response-group-update.component.html',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterModule, TranslateDirective, AlertErrorComponent, NgFor, NgIf, FaIconComponent],
})
export class ResponseGroupUpdateComponent implements OnInit {
  isSaving = false;
  questions: IQuestion[] = [];
  editForm: UntypedFormGroup;

  constructor(
    protected responseGroupService: ResponseGroupService,
    protected questionService: QuestionService,
    protected activatedRoute: ActivatedRoute,
    protected fb: UntypedFormBuilder,
  ) {
    this.editForm = this.fb.group({
      id: [],
      questionId: [],
      predictionIds: [],
    });
  }

  ngOnInit(): void {
    this.activatedRoute.data.subscribe(({ responseGroup }) => {
      this.updateForm(responseGroup);
      this.questionService.query().subscribe((res: HttpResponse<IQuestion[]>) => (this.questions = res.body || []));
    });
  }

  previousState(): void {
    window.history.back();
  }

  save(): void {
    this.isSaving = true;
    const responseGroup = this.createFromForm();
    if (responseGroup.id !== undefined) {
      this.subscribeToSaveResponse(this.responseGroupService.update(responseGroup));
    } else {
      this.subscribeToSaveResponse(this.responseGroupService.create(responseGroup));
    }
  }

  trackById(index: number, item: IQuestion): any {
    return item.id;
  }

  protected subscribeToSaveResponse(result: Observable<HttpResponse<IResponseGroup>>): void {
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

  protected updateForm(responseGroup: IResponseGroup): void {
    this.editForm.patchValue({
      id: responseGroup.id,
      questionId: responseGroup.questionId,
      predictionIds: responseGroup.predictionIds ? responseGroup.predictionIds.join(', ') : '',
    });
  }

  protected createFromForm(): IResponseGroup {
    const predictionIdsStr = this.editForm.get(['predictionIds'])!.value;
    const predictionIds = predictionIdsStr
      ? predictionIdsStr
          .split(',')
          .map((id: string) => parseInt(id.trim(), 10))
          .filter((id: number) => !isNaN(id))
      : [];

    return {
      ...new ResponseGroup(),
      id: this.editForm.get(['id'])!.value,
      questionId: this.editForm.get(['questionId'])!.value,
      predictionIds: predictionIds,
    };
  }
}
