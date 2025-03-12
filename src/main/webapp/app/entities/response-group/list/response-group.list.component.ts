import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IResponseGroup } from '../response-group.model';
import { NgIf, NgFor } from '@angular/common';
import { forkJoin, firstValueFrom } from 'rxjs';
import { TranslateDirective } from 'app/shared/language/translate.directive';
import { ResponseGroupService } from '../service/response-group.service.component';

@Component({
  selector: 'app-response-group-list',
  templateUrl: './response-group.list.component.html',
  standalone: true,
  imports: [TranslateDirective, NgFor, NgIf],
})
export class ResponseGroupListComponent implements OnInit {
  responseGroups: IResponseGroup[] = []; // Array to store response groups

  constructor(
    private responseGroupService: ResponseGroupService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  // Method to load all response groups
  async loadAll(): Promise<void> {
    const response = await firstValueFrom(this.responseGroupService.query());
    this.responseGroups = response.body || [];
    // eslint-disable-next-line no-console
    console.log('Loaded response groups:', this.responseGroups);
  }

  // Method to view response group details
  view(id: number): void {
    this.router.navigate(['/responseGroups', id, 'view']);
  }

  // Method to edit a response group
  edit(id: number): void {
    this.router.navigate(['/responseGroups', id, 'edit']);
  }

  // Method to delete a response group
  async delete(id: number): Promise<void> {
    if (confirm('Are you sure you want to delete this response group?')) {
      try {
        await firstValueFrom(this.responseGroupService.delete(id));
        await this.loadAll(); // Reload the list after deletion
      } catch (err: any) {
        alert(`Failed to delete response group with id ${id}. Please try again.`);
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

    const responseGroupsToDelete = this.responseGroups.filter(rg => rg.questionId === numericQuestionId);

    if (responseGroupsToDelete.length === 0) {
      alert(`No response groups found for exam ${numericQuestionId}`);
      return;
    }

    if (confirm(`Are you sure you want to delete all ${responseGroupsToDelete.length} response groups for exam ${numericQuestionId}?`)) {
      const deleteObservables = responseGroupsToDelete
        .filter(rg => rg.id !== undefined)
        .map(rg => this.responseGroupService.delete(rg.id!));

      try {
        await firstValueFrom(forkJoin(deleteObservables));
        await this.loadAll();
      } catch (err: any) {
        console.error(`Error deleting response groups for question ${numericQuestionId}:`, err);
        alert(`Failed to delete some or all response groups for question ${numericQuestionId}. Please try again.`);
        await this.loadAll();
      }
    }
  }

  async deleteAllResponseGroups(): Promise<void> {
    const responseGroupsToDelete = this.responseGroups
      .filter(rg => rg.id !== undefined)
      .map(rg => this.responseGroupService.delete(rg.id!));

    if (responseGroupsToDelete.length === 0) {
      alert(`No response groups found to delete`);
      return;
    }

    if (confirm('Are you sure you want to delete all response groups?')) {
      try {
        await firstValueFrom(forkJoin(responseGroupsToDelete));
        await this.loadAll();
        alert('Successfully deleted all response groups');
      } catch (err: any) {
        console.error('Error deleting all response groups:', err);
        alert('Failed to delete some or all response groups. Please try again.');
        await this.loadAll();
      }
    }
  }
}
