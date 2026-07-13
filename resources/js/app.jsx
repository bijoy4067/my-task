import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import PageRender from './Pages/PageRender';

createRoot(document.getElementById('app')).render(
	<BrowserRouter>
		<PageRender />
	</BrowserRouter>,
);
