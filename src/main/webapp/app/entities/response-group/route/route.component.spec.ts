import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RouteComponent } from './response-group-routing.module';

describe('RouteComponent', () => {
  let component: RouteComponent;
  let fixture: ComponentFixture<RouteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouteComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RouteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
