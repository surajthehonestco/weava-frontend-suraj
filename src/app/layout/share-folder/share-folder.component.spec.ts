import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShareFolderComponent } from './share-folder.component';

describe('ShareFolderComponent', () => {
  let component: ShareFolderComponent;
  let fixture: ComponentFixture<ShareFolderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShareFolderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShareFolderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
