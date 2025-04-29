import { Component, OnInit } from '@angular/core';
import { PredictionService } from 'app/entities/prediction/service/prediction.service';
import { Router } from '@angular/router';
import { IPrediction } from '../prediction.model';
import { NgIf, NgFor } from '@angular/common';
import { forkJoin, firstValueFrom } from 'rxjs';
import { TranslateDirective } from 'app/shared/language/translate.directive';
import { RouterModule } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ResponseGroupService } from 'app/entities/response-group/service/response-group.service.component';

@Component({
  selector: 'app-prediction-list',
  templateUrl: './list.component.html',
  standalone: true,
  imports: [TranslateDirective, NgFor, NgIf, RouterModule, FaIconComponent],
})
export class PredictionListComponent implements OnInit {
  predictions: IPrediction[] = []; // Array to store predictions

  constructor(
    private predictionService: PredictionService,
    private router: Router,
    private responseGroupService: ResponseGroupService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  // Method to load all predictions
  async loadAll(): Promise<void> {
    const response = await firstValueFrom(this.predictionService.query());
    this.predictions = response.body || [];
    // eslint-disable-next-line no-console
    console.log('Loaded predictions:', this.predictions);
  }

  // Method to view prediction details
  view(id: number): void {
    this.router.navigate(['/predictions', id, 'view']);
  }

  // Method to edit a prediction
  edit(id: number): void {
    this.router.navigate(['/predictions', id, 'edit']);
  }

  // Method to delete a prediction
  async delete(id: number): Promise<void> {
    if (confirm('Are you sure you want to delete this prediction?')) {
      try {
        let responseGroup = (await firstValueFrom(this.responseGroupService.findByPredictionId(id))).body;
        if (responseGroup) {
          responseGroup.predictionIds = responseGroup.predictionIds!.filter(num => num !== id);

          if (responseGroup.predictionIds.length === 0) {
            this.responseGroupService.delete(responseGroup.id!).subscribe({
              next: () => {
                console.log('Response group deleted');
              },
              error: err => {
                console.error('Failed to delete response group:', err);
              },
            });
          } else {
            this.responseGroupService.update(responseGroup).subscribe({
              next: res => {
                console.log('Response group updated:', res.body);
              },
              error: err => {
                console.error('Failed to update response group:', err);
              },
            });
          }
        }

        await firstValueFrom(this.predictionService.delete(id));
        await this.loadAll(); // Reload the list after deletion
      } catch (err: any) {
        alert(`Failed to delete prediction with id ${id}. Please try again.`);
        console.error(err);
      }
    }
  }

  async deleteByQuestion(questionId: string): Promise<void> {
    const numericQuestionId = parseInt(questionId, 10);
    if (!numericQuestionId) {
      alert('Please enter a valid question ID');
      return;
    }

    const predictionsToDelete = this.predictions.filter(p => p.questionId === numericQuestionId);

    if (predictionsToDelete.length === 0) {
      alert(`No predictions found for exam ${numericQuestionId}`);
      return;
    }

    if (confirm(`Are you sure you want to delete all ${predictionsToDelete.length} predictions for exam ${numericQuestionId}?`)) {
      try {
        for (const prediction of predictionsToDelete) {
          if (prediction.id !== undefined) {
            const responseGroupRes = await firstValueFrom(this.responseGroupService.findByPredictionId(prediction.id));
            const responseGroup = responseGroupRes.body;

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

        // After all response groups are handled, delete all predictions in parallel
        const deleteObservables = predictionsToDelete.filter(p => p.id !== undefined).map(p => this.predictionService.delete(p.id!));

        await firstValueFrom(forkJoin(deleteObservables));
        await this.loadAll();
      } catch (err: any) {
        console.error(`Error deleting predictions or response groups for question ${numericQuestionId}:`, err);
        alert(`Failed to delete some or all predictions/response groups for question ${numericQuestionId}. Please try again.`);
        await this.loadAll();
      }
    }
  }

  async deleteAllPredictions(): Promise<void> {
    const predictionsToDelete = this.predictions.filter(p => p.id !== undefined);

    if (predictionsToDelete.length === 0) {
      alert(`No predictions found to delete`);
      return;
    }

    if (confirm('Are you sure you want to delete all predictions?')) {
      try {
        // First, handle responseGroup updates or deletions
        for (const prediction of predictionsToDelete) {
          const responseGroupRes = await firstValueFrom(this.responseGroupService.findByPredictionId(prediction.id!));
          const responseGroup = responseGroupRes.body;

          if (responseGroup) {
            responseGroup.predictionIds = responseGroup.predictionIds!.filter(pid => pid !== prediction.id);

            if (responseGroup.predictionIds.length === 0) {
              await firstValueFrom(this.responseGroupService.delete(responseGroup.id!));
            } else {
              await firstValueFrom(this.responseGroupService.update(responseGroup));
            }
          }
        }

        // Now delete all predictions
        const deleteObservables = predictionsToDelete.map(p => this.predictionService.delete(p.id!));
        await firstValueFrom(forkJoin(deleteObservables));

        await this.loadAll();
        alert('Successfully deleted all predictions');
      } catch (err: any) {
        console.error('Error deleting predictions or response groups:', err);
        alert('Failed to delete some or all predictions or response groups. Please try again.');
        await this.loadAll();
      }
    }
  }
}
