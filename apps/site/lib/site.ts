/** Контакты и постоянные данные объекта. Единственный источник для всего сайта. */
export const SITE = {
  name: 'Бизнес-центр «Маяк»',
  shortName: 'БЦ «Маяк»',
  url: 'https://mayak-d.ru',
  phone: '+7 (916) 763-02-07',
  phoneHref: '+79167630207',
  email: 'info@mayak-d.ru',
  /** Письмо с заранее заполненной темой — запасной канал связи */
  mailto: (subject: string, body = '') =>
    `mailto:info@mayak-d.ru?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`,
  address: 'Московская область, г. Дмитров, мкр. им. Владимира Махалина, д. 20',
  addressShort: 'Дмитров, мкр. им. Владимира Махалина, 20',
  office: 'офис 302',
  hours: 'Пн–Пт, 9:00–18:00',
  routeUrl: 'https://yandex.ru/maps/?rtext=~Дмитров,%20микрорайон%20имени%20Махалина,%2020',
  mapEmbed: 'https://yandex.ru/map-widget/v1/?mode=search&text=Дмитров,%20микрорайон%20имени%20Махалина,%2020&z=16',
} as const

export const NAV = [
  { href: '/#about',      label: 'О бизнес-центре' },
  { href: '/offices',     label: 'Офисы' },
  { href: '/services',    label: 'Услуги' },
  { href: '/#advantages', label: 'Преимущества' },
  { href: '/#location',   label: 'Расположение' },
  { href: '/contacts',    label: 'Контакты' },
] as const
