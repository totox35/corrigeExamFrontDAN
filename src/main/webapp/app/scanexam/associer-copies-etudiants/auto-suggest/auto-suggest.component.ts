import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MltComponent } from 'app/scanexam/mlt/mlt.component';
import { firstValueFrom, forkJoin, Subject } from 'rxjs';

@Component({
  selector: 'jhi-auto-suggest',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auto-suggest.component.html',
  styleUrl: './auto-suggest.component.scss',
})
export class AutoSuggestComponent {
  public suggestedName: string | undefined = '';
  public suggestedFirstName: string | undefined = '';
  public suggestedINE: string | undefined = '';
  isLoading: boolean = false; // Indicateur de chargement
  error: string | null = null; // Pour gérer les erreurs
  selectedTemplate: 'autobind' | 'create' = 'create';

  // Subject pour émettre les changements
  private suggestedValuesSubject = new Subject<{ name: string; firstName: string; ine: string }>();

  // Observable exposé pour les abonnements
  suggestedValues$ = this.suggestedValuesSubject.asObservable();

  constructor(
    private mltcomponent: MltComponent,
    private cdr: ChangeDetectorRef,
  ) {}

  emitSuggestions() {
    if (this.suggestedName && this.suggestedFirstName && this.suggestedINE) {
      this.suggestedValuesSubject.next({
        name: this.suggestedName,
        firstName: this.suggestedFirstName,
        ine: this.suggestedINE,
      });
    }
  }

  clearSuggestions() {
    this.suggestedFirstName = '';
    this.suggestedName = '';
    this.suggestedINE = '';
  }

  setTemplate(template: 'autobind' | 'create') {
    this.selectedTemplate = template;
    this.cdr.detectChanges();
  }

  replacePatterns(): void {
    const patterns = new Map<string, string>([
      [' ', ''], // Remplacer les espaces par des vides
      [';', 'i'], // Remplacer les points-virgules par des "i"
      ["'", ''], // Remplacer les apostrophes par des vides
      ['/', ''], // Remplacer les slashs par des vides
    ]);

    if (this.suggestedName) {
      this.suggestedName = this.applyPatterns(this.suggestedName, patterns);
    }
    if (this.suggestedFirstName) {
      this.suggestedFirstName = this.applyPatterns(this.suggestedFirstName, patterns);
    }
    if (this.suggestedINE) {
      this.suggestedINE = this.applyPatterns(this.suggestedINE, patterns);
    }
    this.cdr.detectChanges();
  }

  private applyPatterns(value: string, patterns: Map<string, string>): string {
    let result = value;
    patterns.forEach((replacement, pattern) => {
      const regex = new RegExp(pattern, 'g');
      result = result.replace(regex, replacement);
    });
    return result;
  }

  async loadNameSuggestions(nameImageImg: any, firstnameImageImg: any, ineImageImg: any): Promise<void> {
    try {
      this.isLoading = true; // Commence le chargement

      const results: [string | undefined, string | undefined, string | undefined] = await firstValueFrom(
        forkJoin([
          this.mltcomponent.executeMLT(nameImageImg),
          this.mltcomponent.executeMLT(firstnameImageImg),
          this.mltcomponent.executeMLT(ineImageImg),
        ]),
      );
      if (results[0] && results[1] && results[2]) {
        this.suggestedName = results[0];
        this.suggestedFirstName = results[1];
        this.suggestedINE = results[2];
      } else {
        throw new Error('Les résultats de l’inférence sont incomplets.');
      }
    } catch (err) {
      console.error('Erreur lors de l’inférence :', err);
      this.error = 'Une erreur est survenue lors de l’inférence.';
    } finally {
      this.emitSuggestions();
      this.isLoading = false;
    }
  }
}
