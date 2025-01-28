import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AjouterpdfComponent } from './ajouterpdf.component';

describe('AjouterpdfComponent', () => {
  let component: AjouterpdfComponent;
  let fixture: ComponentFixture<AjouterpdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AjouterpdfComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AjouterpdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
