import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import { DataUtils, FileLoadError } from 'app/core/util/data-util.service';
import { EventManager, EventWithContent } from 'app/core/util/event-manager.service';
import { AlertError } from 'app/shared/alert/alert-error.model';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from '../../shared/language/translate.directive';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BlockUIModule } from 'primeng/blockui';
import { ToastModule } from 'primeng/toast';
import { PdfService } from '../services/pdf.service';
import { CommonModule } from '@angular/common';
import { CourseService } from 'app/entities/course/service/course.service';

@Component({
  selector: 'jhi-ajouterpdf',
  templateUrl: './ajouterpdf.component.html',
  styleUrls: ['./ajouterpdf.component.scss'],
  providers: [MessageService, ConfirmationService],
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    BlockUIModule,
    ProgressSpinnerModule,
    TranslateDirective,
    FaIconComponent,
    FormsModule,
    ReactiveFormsModule,
    NgxExtendedPdfViewerModule,
  ],
})
export class AjouterpdfComponent implements OnInit, AfterViewInit {
  blocked = false;
  courseid: string | undefined = undefined;
  isSaving = false;
  coursName = '';
  faDownload = faDownload;
  ajouterPdfForm: UntypedFormGroup;
  errorParsingPdf = false;
  fileName: string = '';
  pdfNames: string[] = [];

  constructor(
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
    public confirmationService: ConfirmationService,
    private fb: UntypedFormBuilder,
    protected dataUtils: DataUtils,
    protected eventManager: EventManager,
    protected courseService: CourseService,
    private ref: ChangeDetectorRef,
    private translateService: TranslateService,
    private titleService: Title,
    private pdfService: PdfService,
  ) {
    this.ajouterPdfForm = this.fb.group({
      pdfTitle: [null, [Validators.required]],
      pdfFile: [null, [Validators.required]],
      pdfFileContentType: [null, [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe(params => {
      const id = params.get('courseid');
      if (id !== null) {
        this.courseid = id;
        this.courseService.find(+this.courseid).subscribe(c => {
          this.coursName = c.body?.name ?? '';
          this.updateTitle();
          this.translateService.onLangChange.subscribe(() => {
            this.updateTitle();
          });
        });
      }
    });

    //console.log("The course id is" + this.courseid)
    this.loadPdfNames();
  }

  loadPdfNames(): void {
    if (this.courseid) {
      this.pdfService.getAllPdfNames(this.courseid).subscribe(response => {
        this.pdfNames = response.output.split('\n').filter((name: string) => name.trim() !== '');
      });
    } else {
      console.error('courseid is missing');
    }
  }

  updateTitle(): void {
    this.activatedRoute.data.subscribe(data => {
      this.translateService.get(data['pageTitle'], { courseName: this.coursName }).subscribe(e1 => {
        this.titleService.setTitle(e1);
      });
    });
  }

  ngAfterViewInit(): void {
    this.ajouterPdfForm.markAllAsTouched();
  }

  gotoUE(): void {
    if (this.courseid !== undefined) {
      this.router.navigateByUrl(`/course/${this.courseid}`);
    }
  }

  setFileData(event: Event, field: string): void {
    this.dataUtils.loadFileToForm(event, this.ajouterPdfForm, field, false).subscribe({
      next: () => {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          this.fileName = file.name.replace('.pdf', '');
          if (!this.ajouterPdfForm.get('pdfTitle')?.value) {
            this.ajouterPdfForm.patchValue({ pdfTitle: this.fileName });
          }
        }
      },
      error: (err: FileLoadError) => {
        this.eventManager.broadcast(new EventWithContent<AlertError>('gradeScopeIsticApp.error', { ...err, key: 'error.file.' + err.key }));
      },
    });
  }

  updatePdfName(): void {
    const title = this.ajouterPdfForm.get('pdfTitle')?.value;
    if (title) {
      this.fileName = title;
    }
  }

  save(): void {
    this.isSaving = true;
    const pdfTitle = this.ajouterPdfForm.get('pdfTitle')?.value || this.fileName;
    const pdfData = {
      content: this.ajouterPdfForm.get(['pdfFile'])!.value,
      contentContentType: this.ajouterPdfForm.get(['pdfFileContentType'])!.value,
    };

    this.pdfService.addPdf(pdfTitle, pdfData, this.courseid!).subscribe({
      next: () => {
        this.isSaving = false;
        this.gotoUE();
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  public onPdfError(): void {
    this.errorParsingPdf = true;
    this.ajouterPdfForm.patchValue({ pdfFile: null });
    this.ajouterPdfForm.patchValue({ pdfFileContentType: null });
    this.ref.detectChanges();
  }

  public onPdfLoaded(): void {
    this.errorParsingPdf = false;
  }
}
