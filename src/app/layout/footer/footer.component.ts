import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  @Output() tabChange = new EventEmitter<string>();
  selectedTab: string = 'highlights'; 

  changeTab(tab: string) {
    this.tabChange.emit(tab);
    this.selectedTab = tab;
  }
}
