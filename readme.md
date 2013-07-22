# Anchor Birmanizer #

![Как это работает](http://vzryvy.ru/AnchorBirmanizer/birmanizer.jpg)

jQuery-плагин для «бирманизации» ссылок. 

[Пост Ильи Бирмана](http://ilyabirman.ru/meanwhile/2008/12/30/1/), в котором объясняется принцип работы.

[Демо](http://vzryvy.ru/AnchorBirmanizer/)

[Вопросы и предложения](http://langsam.ru/ris/post/2397)


## Протестированные браузеры ##

* IE 9+ (не работает в версиях 8 и ниже)

* Chrome 1+

* FF 3+

* Opera 10.0+ 

* Safari 4.0+


## Скачать ##

[Скачать полную версию](http://vzryvy.ru/AnchorBirmanizer/AnchorBirmanizer.js) (с комментариями)

[Скачать минифицированную версию](http://vzryvy.ru/AnchorBirmanizer/AnchorBirmanizer.min.js)


## Как вызвать ##

```
<script type="text/javascript" src="AnchorBirmanizer.js"></script>
```

И один из трех вариантов: 

```
$(document).birmanizeAnchors();         // без генерации стилей
$(document).birmanizeAnchors(true);     // чтобы автоматически сгенерировать стили (если используется text-decoration: underline)
$(document).birmanizeAnchors(options);  // см. ниже
```


## Стили ##

### text-decoration: underline ###

Если для ссылок используется text-decoration: underline, то проще всего сгенерировать нужные стили самим плагином с помощью `$(document).birmanizeAnchors(true)`. 

Если делать вручную, то нужно добавить в ЦСС правила:
```
.birmanized-anchor-within-quotes {text-decoration: underline;}
			
.birmanized-anchor {text-decoration: none !important;}
```

### border-bottom ###

Если для ссылок используется border-bottom, то нужно:

1. Добавить правило `.birmanized-anchor {border-bottom: none;}`

2. К селекторам правил, определяющих вид ссылок, добавить `, [селектор] .birmanized-anchor-within-quotes`. Например: `a:visited {...}` → `a:visited, a:visited .birmanized-anchor-within-quotes {...}`

## Опции ##

------
```
charsOpening          : ['«', '„', '('],
charsClosing          : ['»', '“', ')'],
```

Символы, на которые срабатывает скрипт. У парных символов должны быть одинаковые индексы в массивах

------
```
nameClass             : 'birmanized-anchor',
```

Имя класса, который добавляется бирманизированным ссылка

------
```
nameClassWithinQuotes : 'birmanized-anchor-within-quotes',
```

Имя класса, который добавляется в спане внутри бирманизированных ссылок (`<a>«<span class="foo">bar</span>»</a>`)

------
```
doInvert              : true,
```

Делать ли инвертирование ссылок (`«<a>foo</a>» → <a>«foo»</a>`) (нужно для дальнейшей бирманизации)

------
```
doAddStyle            : false,
```

Добавлять ли стили (только при использовании `text-decoration: underline`)

------
```
classesIgnored        : []
```

Ссылки с этими классами игнорируются.


## Почему Яваскрипт ##

1. Решение на Яваскрипте легко подключить к уже работающим проектам.

2. У ХТМЛ слишком сложная грамматика, чтобы парсить ее регулярными выражениями. 

3. Современные браузеры хорошо и быстро парсят ХТМЛ и работают с ДОМом; Яваскрипт включен у 99,9% пользователей. 

4. Работая с ДОМом, можно предусмотреть сложные случаи, напр.: спаны, обрамляющие открывающие кавычки (для реализации висячей пунктуации), спаны внутри ссылок (в том числе пустые, в начале и в конце). 

5. Если для подчеркивания ссылок используется `text-decoration: underline`, то скрипт сможет создать и вставить нужные стили. Для подчеркивания с помощью `border-bottom` легко сделать новые стили.


## Лицензии ##

http://www.opensource.org/licenses/mit-license.php

http://www.gnu.org/licenses/gpl.html