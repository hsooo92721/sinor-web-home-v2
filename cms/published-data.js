async function read(name) {
 const response = await fetch(new URL(name, import.meta.url), {cache:'no-cache'});
 if (!response.ok) throw new Error('배포 데이터를 불러오지 못했습니다.');
 return response.json();
}
export const publishedEvents = read('event-published.json');
export const publishedForms = read('form-published.json');
