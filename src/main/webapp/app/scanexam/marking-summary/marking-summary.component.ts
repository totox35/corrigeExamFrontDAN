import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarkingExamStateDTO, ExamService } from 'app/entities/exam/service/exam.service';
import { CacheServiceImpl } from '../db/CacheServiceImpl';
import { HttpClient } from '@angular/common/http';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import { PreferenceService } from '../preference-page/preference.service';
import { ButtonDirective } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TranslateDirective } from '../../shared/language/translate.directive';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { TooltipModule } from 'primeng/tooltip';
import { HasAnyAuthorityDirective } from '../../shared/auth/has-any-authority.directive';
import { NgIf, NgFor, PercentPipe } from '@angular/common';
import { ResponseGroupService } from 'app/entities/response-group/service/response-group.service.component';

@Component({
  selector: 'jhi-marking-summary',
  templateUrl: './marking-summary.component.html',
  styleUrls: ['./marking-summary.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    HasAnyAuthorityDirective,
    TooltipModule,
    FaIconComponent,
    TranslateDirective,
    TabViewModule,
    NgFor,
    ButtonDirective,
    RouterLink,
    PercentPipe,
    TranslateModule,
  ],
})
export class MarkingSummaryComponent implements OnInit {
  questionNumeros: Array<number> = [];
  public examId = -1;
  public dataExam: MarkingExamStateDTO = {
    nameExam: '',
    questions: [],
    sheets: [],
  };
  public pageInTemplate = 1;
  public errorMsg: string | undefined = undefined;

  public constructor(
    private activatedRoute: ActivatedRoute,
    private examService: ExamService,
    private router: Router,
    private db: CacheServiceImpl,
    private preferenceService: PreferenceService,
    protected applicationConfigService: ApplicationConfigService,
    private translateService: TranslateService,
    private titleService: Title,
    private http: HttpClient,
    private responsegroupService: ResponseGroupService,
  ) {}

  public ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe(params => {
      this.examId = parseInt(params.get('examid') ?? '-1', 10);

      this.db.countPageTemplate(+this.examId).then(pageInTemplate => {
        this.pageInTemplate = pageInTemplate;

        this.examService
          .getExamDetails(this.examId)
          .then(dataExam => {
            this.dataExam = dataExam;
            const m = this.preferenceService.generateRandomOrderForQuestion(dataExam.questions, dataExam.sheets.length, this.examId);
            if (m.size > 0) {
              this.dataExam.questions.forEach((q, index) => {
                if (q.randomHorizontalCorrection) {
                  const r = m.get(index + 1)!;
                  let found = false;
                  for (let index1 = 0; index1 < r.length && !found; index1++) {
                    const element = r[index1];

                    if (q.unmarkedSheetIndex.indexOf(element - 1) !== -1) {
                      q.firstUnmarkedSheet = (element - 1) * pageInTemplate;
                      found = true;
                    }
                  }
                }
              });
            }

            this.updateTitle();
            this.translateService.onLangChange.subscribe(() => {
              this.updateTitle();
            });

            this.questionNumeros = Array.from(new Set(this.dataExam.questions.map(q => q.numero))).sort((n1, n2) => n1 - n2);
          })
          .catch(() => {
            this.errorMsg = 'scanexam.error';
          });
      });
    });
  }

  updateTitle(): void {
    this.activatedRoute.data.subscribe(e => {
      this.translateService.get(e['pageTitle'], { examName: this.dataExam.nameExam }).subscribe(e1 => {
        this.titleService.setTitle(e1);
      });
    });
  }

  public getTotalAnswered(): number {
    if (this.dataExam.questions.length === 0) {
      return 0;
    }

    return this.dataExam.questions.map(q => q.answeredSheets).reduce((q1, q2) => q1 + q2);
  }

  cleanSheet(): void {
    this.http.delete<any>(this.applicationConfigService.getEndpointFor('api/cleanExamSheet/' + this.examId)).subscribe(() => {
      window.location.reload();
    });
  }

  public goToExam(): void {
    this.router.navigateByUrl(`/exam/${this.examId}`);
  }

  //Adding LLM

  proposeComments(): void {
    this.getCommentNumber('Please enter number of comments you want:').then(result => {
      if (result.confirmed && result.value !== null) {
        this.responsegroupService
          .proposeComments({
            question: 'Comment un humain survivre?',
            student_answers: ['Il doivent respirer et boire du leau et manger pour survivre.', 'Je ne sais pas'],
            nb_comments: 5,
          })
          .subscribe(async response => {
            console.log(response);
          });
      }
    });
  }

  getCommentNumber(message: string): Promise<{ confirmed: boolean; value: number | null }> {
    return new Promise(resolve => {
      // Create an overlay for detecting clicks outside
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: '9998',
      });

      // Create dialog container
      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '24px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        maxWidth: '80%',
        width: '400px',
        textAlign: 'center',
        zIndex: '9999',
      });

      // Message element
      const messageEl = document.createElement('p');
      Object.assign(messageEl.style, {
        marginBottom: '20px',
        fontSize: '16px',
        wordWrap: 'break-word',
      });
      messageEl.textContent = message;

      // Input field
      const input = document.createElement('input');
      Object.assign(input.style, {
        width: '100%',
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '16px',
        boxSizing: 'border-box',
        marginBottom: '20px',
      });
      input.type = 'number';
      input.min = '1';
      input.autofocus = true;

      // Buttons container
      const buttons = document.createElement('div');
      buttons.style.marginTop = '20px';

      // OK Button
      const okButton = document.createElement('button');
      Object.assign(okButton.style, {
        marginRight: '10px',
        padding: '8px 16px',
        backgroundColor: '#00BCD4',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      });
      okButton.textContent = 'OK';
      okButton.id = 'confirm-ok';

      // Cancel Button
      const cancelButton = document.createElement('button');
      Object.assign(cancelButton.style, {
        padding: '8px 16px',
        backgroundColor: '#f5f5f5',
        border: '1px solid #ccc',
        borderRadius: '4px',
        cursor: 'pointer',
      });
      cancelButton.textContent = 'Cancel';
      cancelButton.id = 'confirm-cancel';

      // Assemble elements
      buttons.append(cancelButton, okButton);
      dialog.append(messageEl, input, buttons);

      // Add overlay first, then dialog
      document.body.appendChild(overlay);
      document.body.appendChild(dialog);

      // Function to clean up and close dialog
      const closeDialog = (confirmed: boolean, value: number | null) => {
        document.body.removeChild(overlay);
        document.body.removeChild(dialog);
        resolve({ confirmed, value });
      };

      // Event listeners
      okButton.addEventListener('click', () => {
        const value = parseInt(input.value, 10);

        if (isNaN(value) || !Number.isInteger(value)) {
          closeDialog(false, null);
        } else {
          closeDialog(true, value);
        }
      });

      cancelButton.addEventListener('click', () => {
        closeDialog(false, null);
      });

      // Handle clicking outside the dialog
      overlay.addEventListener('click', event => {
        if (event.target === overlay) {
          closeDialog(false, null);
        }
      });

      // Prevent clicks inside dialog from closing it
      dialog.addEventListener('click', event => {
        event.stopPropagation();
      });

      // Handle Enter key
      input.addEventListener('keyup', event => {
        if (event.key === 'Enter') {
          okButton.click();
        }
      });
    });
  }
}
