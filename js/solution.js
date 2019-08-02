'use strict';

// Дипломный проект курса «JavaScript в браузере»

// ================== БЛОК ПОЛУЧЕННЫХ ИЗ DOM ЭЛЕМЕНТОВ, ПЕРЕМЕННЫХ ==================

const wrap = document.querySelector('.wrap'),
      burger = document.querySelector('.burger'),
      menu = document.querySelector('.menu'),
      urlShare = document.querySelector('.menu__url'),
      menuCopy = document.querySelector('.menu_copy'),
      menuColors = document.querySelectorAll('.menu__color'),
      menuModeElements = document.querySelectorAll('.mode'),
      liModeNew = menu.querySelector('.new'),
      errorBlock = document.querySelector('.error'),
      errorText = errorBlock.querySelector('.error__message'),
      loader = document.querySelector('.image-loader'),
      share = document.querySelector('.share'),
      currentImage = document.querySelector('.current-image'),
      comments = document.querySelector('.comments'),
      commentsForm = document.querySelector('.comments__form').cloneNode(true),
      commentsOn = document.querySelector('#comments-on'),
      commentsOff = document.querySelector('#comments-off'),
      draw = document.querySelector('.draw');

// Для CANVAS
const canvas = document.createElement('canvas'),
      ctx = canvas.getContext('2d'),
      canvasComments = document.createElement('div'),
      BRUSH_RADIUS = 4;

let wss,
    curves = [],
    drawing = false,
    needsRepaint = false,
    brushColor,
    showComments = {};

// Для хранения данных загруженной картинки
let url = new URL(`${window.location.href}`),
    imgId = url.searchParams.get('id'),
    imageId;

// Переменные для функций перемещения блока меню
let relocatableItem = null;
const minX = 0;
const minY = 0;
let maxX, maxY;
let shiftX, shiftY; // переменные расстояния, на которое курсор мыши сдвинут относительно левого-верхнего угла блока меню



// ================== РАЗНОЕ ==================

// Показать/скрыть элемент
function showElement(el) {
  el.style.display = '';
}

function hideElement(el) {
  el.style.display = 'none';
}

// Оптимизируем отрисовку анимации (ограничения частоты запуска функции)
function throttle(callback) {
  let isWaiting = false;
  return function () {
    if (isWaiting) return;

    callback.apply(this, arguments);
    isWaiting = true;
    requestAnimationFrame(() => {
      isWaiting = false;
    });
  }
}

// Оптимизируем частоту вызова функций
function debounce(callback, delay = 0) {
  let timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      callback();
    }, delay);
  };
}

// Производим анимацию
function tick() {
  // перемещаем меню, если оно находится с края окна
  if (menu.offsetHeight > 66) {
    menu.style.left = `${(wrap.offsetWidth - menu.offsetWidth) - 10}px`;
  }

  // рисуем canvas
  if (needsRepaint) {
    repaint();
    needsRepaint = false;
  }

  window.requestAnimationFrame(tick);
}

// Проверяем url на параметр id
function checkId(id) {
  if (!id) return;
  getDataFromServer(id);
  updateMenuCoordinates();
}


// ================== РАСПОЛОЖЕНИЕ БЛОКА МЕНЮ (возможность его перетаскивания в пределах рабочей области) ==================

// Начинаем перетаскивание блока меню при клике на его "корешке"
function moveStart(event) {
  if (!event.target.classList.contains('drag')) return;

  relocatableItem = menu;
  const boundsMenu = relocatableItem.getBoundingClientRect(); // получаем размер элемента и его позицию

  // вычисляем сдвиг указателя мыши относительно левого верхнего края блока меню
  shiftX = event.pageX - boundsMenu.left - window.pageXOffset;
  shiftY = event.pageY - boundsMenu.top - window.pageYOffset;
  maxX = minX + wrap.offsetWidth - relocatableItem.offsetWidth;
  maxY = minY + wrap.offsetHeight - relocatableItem.offsetHeight;
}

// Перемещаем блок меню по направлению движения курсора мыши
function moveMenu(event) {
  if (!relocatableItem) return;

  event.preventDefault();

  let x = event.pageX - shiftX;
  let y = event.pageY - shiftY;

  x = Math.min(x, maxX - 1); // чтобы блок меню не "деформировался"
  x = Math.max(x, minX);

  y = Math.min(y, maxY);
  y = Math.max(y, minY);

  relocatableItem.style.left = `${x}px`;
  relocatableItem.style.top = `${y}px`;

  let menuCoordinates = JSON.stringify({'x': x,'y': y});
  localStorage.setItem('menuCoordinates', menuCoordinates);
}

// Останавливаем движение блока меню
function moveStop() {
  if (!relocatableItem) return;

  relocatableItem = null;
}

// Сохраняем координаты меню при обновлении страницы
function updateMenuCoordinates() {
  if (!localStorage.menuCoordinates) return;

  let menuCoords = JSON.parse(localStorage.menuCoordinates);
  menu.style.left = `${menuCoords.x}px`;
  menu.style.top = `${menuCoords.y}px`;
}

document.addEventListener('mousedown', moveStart);
document.addEventListener('mousemove', throttle(moveMenu));
document.addEventListener('mouseup', moveStop);



// ================== РЕЖИМ ПУБЛИКАЦИЯ ==================

function publication() {
  // задаём начальное положение блока меню
  menu.style.left = 10 + 'px';
  menu.style.top = 10 + 'px';

  currentImage.src = ''; // убираем изображение по умолчанию
  
  menu.dataset.state = 'initial'; // скрываем расширенное меню

  hideElement(burger);
  
  deleteCommentsForm();
}

publication();
tick(); 



// ================== РЕЖИМ РЕЦЕНЗИРОВАНИЕ ==================

checkId(imgId); // Получаем из ссылки параметр id

// Переключаем режим меню в зависимости от ситуации
function review() {
  if (imgId) {
    menu.dataset.state = 'selected';
    comments.dataset.state = 'selected';
  } else {
    menu.dataset.state = 'selected';
    share.dataset.state = 'selected';
  }

  showElement(burger);

  urlShare.value = localStorage.host;
}

currentImage.addEventListener('load', () => {
  hideElement(loader);
  wsConnect();
  createCanvas();
  createCanvasComments();
  updateComments(imageId.comments);
});

// Копируем ссылку в буфер обмена
menuCopy.addEventListener('click', () => {
  urlShare.select();
  document.execCommand('copy');
});

// Клацаем по "бургеру"
burger.addEventListener('click', () => {
  menu.dataset.state = 'default';
  menuModeElements.forEach(elem => elem.dataset.state = '');
});

menuModeElements.forEach(elem => {
  if (!elem.classList.contains('new')) {
    elem.addEventListener('click', (event) => {
      menu.dataset.state = 'selected';
      event.currentTarget.dataset.state = 'selected';
    })
  }
});



// ================== РИСОВАНИЕ ==================

// Меняем текущий цвет
menuColors.forEach(color => {
  if (color.checked) {  
    brushColor = getComputedStyle(color.nextElementSibling).backgroundColor;  
  }

  // получаем цвет кисти при клике на элементе
  color.addEventListener('click', (event) => {
    brushColor = getComputedStyle(event.currentTarget.nextElementSibling).backgroundColor; 
  });
});

// Создаём CANVAS
function createCanvas() {
  const width = getComputedStyle(currentImage).width.slice(0, -2),
        height = getComputedStyle(currentImage).height.slice(0, -2);
  
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.display = 'block';
  canvas.style.zIndex = '1';
  canvasComments.appendChild(canvas);
}

// Рисуем "точку"
function circle(point) {
  ctx.beginPath();
  ctx.arc(...point, BRUSH_RADIUS / 2, 0, 2 * Math.PI);
  ctx.fill();
}

// Рисуем плавную линию между двумя точками
function smoothCurveBetween(p1, p2) {
  const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
  ctx.quadraticCurveTo(...p1, ...cp);
}

// Рисуем плавную линию между множеством точек
function smoothCurve(points) {
  ctx.beginPath();
  ctx.lineWidth = BRUSH_RADIUS;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.moveTo(...points[0]);
  
  for(let i = 1; i < points.length - 1; i++) {
    smoothCurveBetween(points[i], points[i + 1]);
  }

  ctx.stroke();
}

// Координаты положения курсора мыши
function makePoint(x, y) {
  return [x, y];
}

// Перерисуем CANVAS
function repaint() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  curves.forEach((curve) => {
    ctx.strokeStyle = curve.color;
    ctx.fillStyle = curve.color;
    circle(curve[0]);
    smoothCurve(curve);
  });
}

// Отправляем CANVAS на сервер
function sendCanvasToServer() {
  canvas.toBlob(blob => {
    if (!wss) return;

    wss.send(blob);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

// Рисуем только в режиме рисования
canvas.addEventListener('mousedown', (event) => {
  if (draw.dataset.state !== 'selected') return;

  document.querySelectorAll('.comments__form').forEach(form => {
      hideElement(form);
  });
  drawing = true;
  const curve = [];
  curve.color = brushColor;
  curve.push(makePoint(event.offsetX, event.offsetY));
  curves.push(curve);
  needsRepaint = true;
});

canvas.addEventListener('mouseup', (event) => {
  drawing = false;
  document.querySelectorAll('.comments__form').forEach(form => {
    showElement(form);
  });
});

canvas.addEventListener('mouseleave', (event) => {
  drawing = false;
  document.querySelectorAll('.comments__form').forEach(form => {
    showElement(form);
  });
});

canvas.addEventListener('mousemove', (event) => {
  if (!drawing) return;

  curves[curves.length - 1].push(makePoint(event.offsetX, event.offsetY));
  debounceCanvasToServer();
  needsRepaint = true;
});

const debounceCanvasToServer = debounce(sendCanvasToServer, 1000);

// Обёртка для CANVAS и комментариев
function createCanvasComments() {
  const width = getComputedStyle(currentImage).width,
        height = getComputedStyle(currentImage).height;
  
  canvasComments.style.width = width;
  canvasComments.style.height = height;
  canvasComments.style.position = 'absolute';
  canvasComments.style.top = '50%';
  canvasComments.style.left = '50%';
  canvasComments.style.transform = 'translate(-50%, -50%)';
  canvasComments.style.display = 'block';
  wrap.appendChild(canvasComments);

  // отображаем комментарий (по клику) поверх остальных
  canvasComments.addEventListener('click', event => {
    if (!event.target.closest('.comments__form')) return;

    const currentForm = event.target.closest('.comments__form');

    Array.from(canvasComments.querySelectorAll('.comments__form')).forEach(form => {
      form.style.zIndex = 2;
    });

    currentForm.style.zIndex = 3;
  });
}



// ================== КОММЕНТАРИИ ==================

// Создаём новую форму для комментариев при клике на CANVAS
canvas.addEventListener('click', (event) => {
  if (comments.dataset.state !== 'selected' || !commentsOn.checked) return;

  deleteAllBlankCommentFormsExcept();
  minimizeAllComments();

  const newForm = createNewForm();
  newForm.querySelector('.comments__marker-checkbox').checked = true;

  // учитываем смещение курсора мыши, чтобы маркер комментария встал в место клика
  const coordX = event.offsetX - 22;
  const coordY = event.offsetY - 14;
  newForm.style.left = coordX + 'px';
  newForm.style.top = coordY + 'px';

  // в каждую форму добавляем атрибуты data-left и data-top - координаты левого верхнего угла формы относительно currentImage
  newForm.dataset.left = coordX;
  newForm.dataset.top = coordY;
  canvasComments.appendChild(newForm);
});

// Создаём новый элемент form для комментариев
function createNewForm() {
  const newForm = document.createElement('form');
  newForm.classList.add('comments__form');
  newForm.innerHTML = `
    <span class="comments__marker"></span><input type="checkbox" class="comments__marker-checkbox">
    <div class="comments__body">
      <div class="comment">
        <div class="loader">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      <textarea class="comments__input" type="text" placeholder="Напишите ответ..."></textarea>
      <input class="comments__close" type="button" value="Закрыть">
      <input class="comments__submit" type="submit" value="Отправить">
    </div>`;
  showElement(newForm);
  newForm.style.zIndex = 2;
  newForm.querySelector('.loader').parentElement.style.display = 'none';

  // кнопка "Закрыть"
  newForm.querySelector('.comments__close').addEventListener('click', () => {
    if (newForm.querySelectorAll('.comment').length > 1) {
      newForm.querySelector('.comments__marker-checkbox').checked = false;
    } else {
      newForm.remove();
    }
  });

  // кнопка "Отправить"
  newForm.addEventListener('submit', event => {
    event.preventDefault();

    const message = newForm.querySelector('.comments__input').value,
          encodeMsg = encodeURIComponent(message),
          encodeFormLeft = encodeURIComponent(newForm.dataset.left),
          encodeFormTop = encodeURIComponent(newForm.dataset.top);

    const body = `message=${encodeMsg}&left=${encodeFormLeft}&top=${encodeFormTop}`;

    newForm.querySelector('.loader').parentElement.style.display = '';

    fetch(`https://neto-api.herokuapp.com/pic/${imageId.id}/comments`, {
      body: body,
      credentials: 'same-origin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .then(response => {
      if (response.status >= 200 && response.status < 300) {
        return response;
      }
      throw new Error (response.statusText);
    })
    .then(response => response.json())
    .then(response => {
      newForm.querySelector('.comments__input').value = '';
    })
    .catch(err => {
      console.log(`Ошибка отправки комментария на сервер: ${err}`);
      newForm.querySelector('.loader').parentElement.style.display = 'none';
    });
  });

  return newForm;
}

// Удаляем пустую форму комментариев, кроме currentForm
function deleteAllBlankCommentFormsExcept(currentForm = null) {
  document.querySelectorAll('.comments__form').forEach(form => {
    if (form.querySelectorAll('.comment').length < 2 && form !== currentForm) {
      form.remove();
    }
  });
}

// Сворачиваем все комментарии, кроме активного
function minimizeAllComments(currentForm = null) {
  document.querySelectorAll('.comments__form').forEach(form => {
    if (form !== currentForm) {
      form.querySelector('.comments__marker-checkbox').checked = false;
    }
  });
}

// Обновление форм комментарий
function updateComments(newForms) {
  if (!newForms) return;

  Object.keys(newForms).forEach(id => {
    if (id in showComments) return;

    showComments[id] = newForms[id];

    let needCreateNewForm = true;

    // если форма с заданными координатами (left и top) существует - добавляем сообщение в неё
    Array.from(document.querySelectorAll('.comments__form')).forEach(form => {
      if (+form.dataset.left === showComments[id].left && +form.dataset.top === showComments[id].top) {
        hideElement(form.querySelector('.loader').parentElement);
        addCommentToForm(newForms[id], form);
        needCreateNewForm = false;
      }
    });

    // если формы с заданными координатами (left и top) нет на CANVAS - создаём и добавляем в неё сообщение
    if (needCreateNewForm) {
      const newForm = createNewForm();
      newForm.dataset.left = newForms[id].left;
      newForm.dataset.top = newForms[id].top;
      newForm.style.left = newForms[id].left + 'px';
      newForm.style.top = newForms[id].top + 'px';
      addCommentToForm(newForms[id], newForm);
      canvasComments.appendChild(newForm);

      if (commentsOff.checked) {
        hideElement(newForm);
      }
    }
  });
}

// Добавляем новое сообщение в форму
function addCommentToForm(newMsg, form) {
  function getDate(timestamp) {
    const options = {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    const date = new Date(timestamp),
          dateStr = date.toLocaleString(options);

    return dateStr.slice(0, 6) + dateStr.slice(8, 10) + dateStr.slice(11);
  }

  let theNearestLowerDiv = form.querySelector('.loader').parentElement;

  const newMsgDiv = document.createElement('div');
  newMsgDiv.classList.add('comment');
  newMsgDiv.dataset.timestamp = newMsg.timestamp;

  const pCommentTime = document.createElement('p');
  pCommentTime.classList.add('comment__time');
  pCommentTime.innerText = getDate(newMsg.timestamp);
  newMsgDiv.appendChild(pCommentTime);

  const pCommentMessage = document.createElement('p');
  pCommentMessage.classList.add('comment__message');
  pCommentMessage.innerText = newMsg.message;
  newMsgDiv.appendChild(pCommentMessage);

  form.querySelector('.comments__body').insertBefore(newMsgDiv, theNearestLowerDiv);
}

// Вставляем полученные с сервера комментарии
function insertWssComments(wssComment) {
  const wssEditedComment = {};
  wssEditedComment[wssComment.id] = {};
  wssEditedComment[wssComment.id].left = wssComment.left;
  wssEditedComment[wssComment.id].top = wssComment.top;
  wssEditedComment[wssComment.id].message = wssComment.message;
  wssEditedComment[wssComment.id].timestamp = wssComment.timestamp;
  updateComments(wssEditedComment);
}

// Удаляем форму комментариев при загрузке новой картинки
function deleteCommentsForm() {
  const commentsForms = wrap.querySelectorAll('.comments__form');
  Array.from(commentsForms).forEach(item => {item.remove()});
}

// Скрываем/показываем маркеры комментарии
commentsOn.addEventListener('change', checkCommentsState);
commentsOff.addEventListener('change', checkCommentsState);

function checkCommentsState() {
  if (commentsOn.checked) {
    document.querySelectorAll('.comments__form').forEach(form => {
      showElement(form);
    })
  } else {
    document.querySelectorAll('.comments__form').forEach(form => {
      hideElement(form);
    })
  }
}




// ================== ИЗОБРАЖЕНИЕ: ДОБАВЛЕНИЕ (кнопка, Drag&Drop), ПРОВЕРКА, ЗАГРУЗКА НА СЕРВЕР ==================

liModeNew.addEventListener('click', uploadFileFromInput);
wrap.addEventListener('drop', uploadFileFromDragDrop);
wrap.addEventListener('dragover', event => event.preventDefault());

// Загрузка картинки через кнопку "Загрузить новое"
function uploadFileFromInput() {
  hideElement(errorBlock);
  hideElement(loader);

  // создаём input с type="file"
  const inputFile = document.createElement('input');
  inputFile.setAttribute('class', 'inputFile');
  inputFile.setAttribute('type', 'file');
  // inputFile.setAttribute('accept', 'image/jpeg, image/png'); // для отладки
  hideElement(inputFile);
  menu.appendChild(inputFile);

  document.querySelector('.inputFile').addEventListener('change', event => {
    const file = event.currentTarget.files[0];

    if ((file.type === 'image/jpeg') || (file.type === 'image/png')) {
      deleteCommentsForm();
      uploadFileToServer(file);
    } else {
      setTimeout(() => {
        showElement(errorBlock);
      }, 300);
    };
  });

  inputFile.click();
  menu.removeChild(inputFile);
}

// Загрузка картинки с помощью DRAG & DROP
function uploadFileFromDragDrop(event) {
  event.preventDefault();

  const file = event.dataTransfer.files[0];
  
  // выдаём ошибку при повторном drop
  if (imageId) {
    hideElement(loader);
    showElement(errorBlock);
    errorText.textContent = 'Чтобы загрузить новое изображение - пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню';
    setTimeout(() => {
      hideElement(errorBlock);
    }, 10000);
    return;
  }

  // проверяем тип файла
  if ((file.type === 'image/jpeg') || (file.type === 'image/png')) {
    hideElement(errorBlock);
    deleteCommentsForm();
    uploadFileToServer(file);
  } else {
    showElement(errorBlock);
  }
}

// Отправляем картинку на сервер
function uploadFileToServer(file) {
  const formData = new FormData();
  formData.append('title', file.name);
  formData.append('image', file);

  showElement(loader);

  fetch('https://neto-api.herokuapp.com/pic', {
    method: 'POST',
    credentials: 'same-origin',
    body: formData
  })
  .then(response => {
    if (response.status >= 200 && response.status < 300) {
      return response;
    }
    throw new Error(response.statusText);
  })
  .then(response => response.json())
  .then(response => {
    localStorage.removeItem('menuCoordinates');
    getDataFromServer(response.id);
  })
  .catch(err => {
    hideElement(loader);
    console.log(`Ошибка отправки файла на сервер: ${err}`);
  });
};

// Обрабатываем ответ сервера
function getDataFromServer(id) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `https://neto-api.herokuapp.com/pic/${id}`, true);
  xhr.addEventListener('load', () => {
    if (xhr.status === 200) {
      imageId = JSON.parse(xhr.responseText);

      localStorage.host = `${window.location.origin}${window.location.pathname}?id=${imageId.id}`;
      history.pushState(null, null, localStorage.host);

      currentImage.src = imageId.url;

      review();
    }
  });
  xhr.send();
}

// WebSocket-соединение
function wsConnect() {
  wss = new WebSocket(`wss://neto-api.herokuapp.com/pic/${imageId.id}`);

  wss.addEventListener('message', event => {
    const data = JSON.parse(event.data);

    if (data.event === 'pic') {
      if (data.pic.mask) {
        canvas.style.background = `url(${data.pic.mask})`;
      } else {
        canvas.style.background = ``;
      }
    }

    if (data.event === 'comment') {
      insertWssComments(data.comment);
    }

    if (data.event === 'mask') {
      canvas.style.background = `url(${data.url})`;
    }
  });

  wss.addEventListener('error', error => {
    console.log(`Ошибка веб-сокета: ${error.data}`);
  });
}

// Закрываем web-socket
window.addEventListener('beforeunload', () => {
  wss.close(1000);
  console.log('Соединение web-socket закрыто');
});