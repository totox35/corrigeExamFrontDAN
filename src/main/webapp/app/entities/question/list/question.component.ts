import { Component, NgZone, OnInit } from '@angular/core';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, forkJoin, firstValueFrom } from 'rxjs';
import { NgbModal, NgbPagination } from '@ng-bootstrap/ng-bootstrap';

import { IQuestion } from '../question.model';

import { ASC, DESC, ITEMS_PER_PAGE, SORT } from 'app/config/pagination.constants';
import { QuestionService } from '../service/question.service';
import { QuestionDeleteDialogComponent } from '../delete/question-delete-dialog.component';
import { ItemCountComponent } from '../../../shared/pagination/item-count.component';
import { SortByDirective } from '../../../shared/sort/sort-by.directive';
import { SortDirective } from '../../../shared/sort/sort.directive';
import { NgIf, NgFor } from '@angular/common';
import { AlertComponent } from '../../../shared/alert/alert.component';
import { AlertErrorComponent } from '../../../shared/alert/alert-error.component';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from '../../../shared/language/translate.directive';
import { PredictionService } from 'app/entities/prediction/service/prediction.service';
import { ResponseGroupService } from 'app/entities/response-group/service/response-group.service.component';

@Component({
  selector: 'jhi-question',
  templateUrl: './question.component.html',
  standalone: true,
  imports: [
    TranslateDirective,
    FaIconComponent,
    RouterLink,
    AlertErrorComponent,
    AlertComponent,
    NgIf,
    SortDirective,
    SortByDirective,
    NgFor,
    ItemCountComponent,
    NgbPagination,
  ],
})
export class QuestionComponent implements OnInit {
  questions?: IQuestion[];
  isLoading = false;
  totalItems = 0;
  itemsPerPage = ITEMS_PER_PAGE;
  page?: number;
  predicate!: string;
  ascending!: boolean;
  ngbPaginationPage = 1;

  constructor(
    protected questionService: QuestionService,
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
    protected modalService: NgbModal,
    private zone: NgZone,
    private predictionService: PredictionService,
    private responseGroupService: ResponseGroupService,
  ) {}

  loadPage(page?: number, dontNavigate?: boolean): void {
    this.isLoading = true;
    const pageToLoad: number = page ?? this.page ?? 1;

    this.questionService
      .query({
        page: pageToLoad - 1,
        size: this.itemsPerPage,
        sort: this.sort(),
      })
      .subscribe({
        next: (res: HttpResponse<IQuestion[]>) => {
          this.isLoading = false;
          this.onSuccess(res.body, res.headers, pageToLoad, !dontNavigate);
        },
        error: () => {
          this.isLoading = false;
          this.onError();
        },
      });
  }

  ngOnInit(): void {
    this.handleNavigation();
  }

  trackId(index: number, item: IQuestion): number {
    return item.id!;
  }

  async delete(question: IQuestion): Promise<void> {
    try {
      const predictionsRes = await firstValueFrom(this.predictionService.query({ questionId: question.id }));
      const predictions = predictionsRes.body ?? [];

      if (predictions.length === 0) {
        // No predictions, directly open delete modal
        this.openDeleteModal(question);
        return;
      }

      // Handle responseGroups for each prediction
      for (const prediction of predictions) {
        if (prediction.id !== undefined) {
          const responseGroupRes = await firstValueFrom(this.responseGroupService.findByPredictionId(prediction.id));
          const responseGroup = responseGroupRes!.body;

          if (responseGroup) {
            responseGroup.predictionIds = responseGroup.predictionIds!.filter(pid => pid !== prediction.id);

            if (responseGroup.predictionIds.length === 0) {
              await firstValueFrom(this.responseGroupService.delete(responseGroup.id!));
            } else {
              await firstValueFrom(this.responseGroupService.update(responseGroup));
            }
          }
        }
      }

      // After cleaning up responseGroups, delete all predictions
      await firstValueFrom(this.predictionService.deleteByQuestionId(question.id!));

      // Now open the modal to delete the question
      this.openDeleteModal(question);
    } catch (err) {
      console.error('Error during deletion process:', err);
    }
  }

  private openDeleteModal(question: IQuestion): void {
    const modalRef = this.modalService.open(QuestionDeleteDialogComponent, { size: 'lg', backdrop: 'static' });
    if (question.typeAlgoName === 'manuscrit') {
      // TO DO : DELETE ALL PREDICTIONS LINKED TO QUESTION
      // this.predictionService.deleteByQuestionId(question.id!));
      // DID NOT WORK
    }

    modalRef.componentInstance.question = question;
    modalRef.closed.subscribe(reason => {
      if (reason === 'deleted') {
        this.loadPage();
      }
    });
  }

  protected sort(): string[] {
    const result = [this.predicate + ',' + (this.ascending ? ASC : DESC)];
    if (this.predicate !== 'id') {
      result.push('id');
    }
    return result;
  }

  protected handleNavigation(): void {
    combineLatest([this.activatedRoute.data, this.activatedRoute.queryParamMap]).subscribe(([data, params]) => {
      const page = params.get('page');
      const pageNumber = +(page ?? 1);
      const sort = (params.get(SORT) ?? data['defaultSort']).split(',');
      const predicate = sort[0];
      const ascending = sort[1] === ASC;
      if (pageNumber !== this.page || predicate !== this.predicate || ascending !== this.ascending) {
        this.predicate = predicate;
        this.ascending = ascending;
        this.loadPage(pageNumber, true);
      }
    });
  }

  protected onSuccess(data: IQuestion[] | null, headers: HttpHeaders, page: number, navigate: boolean): void {
    this.totalItems = Number(headers.get('X-Total-Count'));
    this.page = page;
    if (navigate) {
      this.zone.run(() => {
        this.router.navigate(['/question'], {
          queryParams: {
            page: this.page,
            size: this.itemsPerPage,
            sort: this.predicate + ',' + (this.ascending ? ASC : DESC),
          },
        });
      });
    }
    this.questions = data ?? [];
    this.ngbPaginationPage = this.page;
  }

  protected onError(): void {
    this.ngbPaginationPage = this.page ?? 1;
  }
}
