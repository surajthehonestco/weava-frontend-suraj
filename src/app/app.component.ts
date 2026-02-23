import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SocketService } from './services/socket.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Weava';

  constructor(private socketService: SocketService) {}

  ngOnInit() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');

    if (token) {
      this.socketService.connect(token);
      console.log('🔁 Socket reconnected on page refresh');
    }

    if (userId) {
      this.socketService.emitLogin(userId);
      console.log('👤 Login event emitted with userId:', userId);
    }
  }
}
