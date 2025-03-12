import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { IResponseGroupe } from '../response-group.model';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { AlertComponent } from '../../../shared/alert/alert.component';
import { AlertErrorComponent } from '../../../shared/alert/alert-error.component';
import { TranslateDirective } from '../../../shared/language/translate.directive';
import { NgIf } from '@angular/common';

@Component({
  selector: 'jhi-response-group-detail',
  templateUrl: './response-group-detail.component.html',
  standalone: true,
  imports: [NgIf, TranslateDirective, AlertErrorComponent, AlertComponent, RouterLink, FaIconComponent],
})
export class ResponseGroupDetailComponent implements OnInit {
  responseGroup: IResponseGroupe | null = null;

  constructor(protected activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.activatedRoute.data.subscribe(({ responseGroup }) => {
      this.responseGroup = responseGroup;
    });
  }

  previousState(): void {
    window.history.back();
  }
}
