import { AfterViewInit, Component, OnInit } from '@angular/core';
import { MltComponent } from 'app/scanexam/mlt/mlt.component';
import { AssocierCopiesEtudiantsComponent } from '../associer-copies-etudiants.component';
import { firstValueFrom, forkJoin } from 'rxjs';

@Component({
  selector: 'jhi-auto-suggest',
  standalone: true,
  imports: [],
  templateUrl: './auto-suggest.component.html',
  styleUrl: './auto-suggest.component.scss',
})
export class AutoSuggestComponent implements AfterViewInit {
  suggestedName: string | undefined = '';
  suggestedFirstName: string | undefined = '';
  suggestedINE: string | undefined = '';
  isLoading: boolean = false; // Indicateur de chargement
  error: string | null = null; // Pour gérer les erreurs

  constructor(
    private mltcomponent: MltComponent,
    private associercopiesetudiantscomponent: AssocierCopiesEtudiantsComponent,
  ) {}

  async ngAfterViewInit(): Promise<void> {
    try {
      // Attendre que les images soient prêtes avant d'appeler action()
      await this.waitForImagesToLoad();
      this.loadNameSuggestions(); // Appelle action une fois que les images sont prêtes
    } catch (err) {
      console.error('Erreur lors de la préparation des images :', err);
    }
  }

  private async waitForImagesToLoad(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (
          this.associercopiesetudiantscomponent.nameImageImg &&
          this.associercopiesetudiantscomponent.firstnameImageImg &&
          this.associercopiesetudiantscomponent.ineImageImg
        ) {
          clearInterval(checkInterval); // Arrêter la vérification
          resolve(); // Les images sont prêtes
        }
      }, 100); // Vérifier toutes les 100ms

      // Timeout après 10 secondes si les images ne sont toujours pas prêtes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Les images n’ont pas pu être chargées à temps.'));
      }, 10000);
    });
  }

  async loadNameSuggestions(): Promise<void> {
    try {
      this.isLoading = true; // Commence le chargement

      // Utilisation de forkJoin pour exécuter les deux requêtes en parallèle
      const results: [string | undefined, string | undefined, string | undefined] = await firstValueFrom(
        forkJoin([
          this.mltcomponent.executeMLT(this.associercopiesetudiantscomponent.nameImageImg),
          this.mltcomponent.executeMLT(this.associercopiesetudiantscomponent.firstnameImageImg),
          this.mltcomponent.executeMLT(this.associercopiesetudiantscomponent.ineImageImg),
        ]),
      ); // Utilisation de firstValueFrom pour obtenir une promesse

      // Vérifie si les résultats sont valides et assigne les valeurs
      if (results[0] && results[1] && results[2]) {
        this.suggestedName = results[0]; // Résultat pour le nom
        this.suggestedFirstName = results[1]; // Résultat pour le prénom
        this.suggestedINE = results[2]; // Résultat pour l'INE
      } else {
        throw new Error('Les résultats de l’inférence sont incomplets.');
      }
    } catch (err) {
      console.error('Erreur lors de l’inférence :', err);
      this.error = 'Une erreur est survenue lors de l’inférence.';
    } finally {
      this.isLoading = false; // Fin du chargement
    }
  }
}
