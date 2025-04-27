import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { IResponseGroup } from '../response-group.model';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { NgIf, NgFor } from '@angular/common';
import { AlertErrorComponent } from '../../../shared/alert/alert-error.component';
import { AlertComponent } from '../../../shared/alert/alert.component';
import { TranslateDirective } from '../../../shared/language/translate.directive';

@Component({
  selector: 'jhi-response-group-detail',
  templateUrl: './response-group-detail.component.html',
  standalone: true,
  imports: [RouterModule, NgIf, NgFor, FaIconComponent, AlertErrorComponent, AlertComponent, TranslateDirective],
})
export class ResponseGroupDetailComponent implements OnInit {
  responseGroup: IResponseGroup | null = null;

  constructor(protected activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.activatedRoute.data.subscribe(({ responseGroup }) => {
      this.responseGroup = responseGroup;
    });
  }

  previousState(): void {
    window.history.back();
  }

  displayEmbedding(embedding?: number[]): string {
    if (!embedding || embedding.length === 0) {
      return '';
    }

    // Display shortened version with first 3 values and total length
    return `[${embedding.slice(0, 3).join(', ')}${embedding.length > 3 ? '...' : ''}] (${embedding.length} values)`;
  }
}
