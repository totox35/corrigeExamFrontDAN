import { Component, OnInit } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { IResponseGroup, ResponseGroup } from '../response-group.model';
import { ResponseGroupService } from '../service/response-group.service.component';
import { NgIf, NgFor } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { AlertErrorComponent } from '../../../shared/alert/alert-error.component';
import { AlertComponent } from '../../../shared/alert/alert.component';
import { TranslateDirective } from '../../../shared/language/translate.directive';

@Component({
  selector: 'jhi-response-group-update',
  templateUrl: './response-group-update.component.html',
  standalone: true,
  imports: [NgIf, NgFor, TranslateDirective, AlertErrorComponent, AlertComponent, FaIconComponent],
})
export class ResponseGroupUpdateComponent implements OnInit {
  isSaving = false;
  responseGroup: IResponseGroup | null = null;
  editForm: FormGroup;

  constructor(
    protected responseGroupService: ResponseGroupService,
    protected activatedRoute: ActivatedRoute,
    private fb: FormBuilder,
  ) {
    this.editForm = this.fb.group({
      id: [],
      questionId: [null, [Validators.required]],
      predictionIds: [],
    });
  }

  ngOnInit(): void {
    this.activatedRoute.data.subscribe(({ responseGroup }) => {
      this.responseGroup = responseGroup;
      if (responseGroup) {
        this.updateForm(responseGroup);
      }
    });
  }

  updateForm(responseGroup: IResponseGroup): void {
    this.editForm.patchValue({
      id: responseGroup.id,
      questionId: responseGroup.questionId,
      predictionIds: responseGroup.predictionIds ? responseGroup.predictionIds.join(',') : '',
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

  private createFromForm(): IResponseGroup {
    return {
      ...new ResponseGroup(),
      id: this.editForm.get(['id'])!.value,
      questionId: this.editForm.get(['questionId'])!.value,
      predictionIds: this.editForm.get(['predictionIds'])!.value
        ? this.editForm
            .get(['predictionIds'])!
            .value.split(',')
            .map((id: string) => parseInt(id.trim(), 10))
        : [],
    };
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
}
