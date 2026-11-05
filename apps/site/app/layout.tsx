import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import MobileCtaBar from '@/components/MobileCtaBar'
import FloatingContacts from '@/components/FloatingContacts'
import { SITE } from '@/lib/site'
import { YM_COUNTER } from '@/lib/analytics'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: 'Аренда офисов в Дмитрове — Бизнес-центр «Маяк»',
    template: '%s — БЦ «Маяк», Дмитров',
  },
  description:
    'Аренда офисов от 10 м² в центре Дмитрова. Бизнес-центр «Маяк»: парковка, лифт, кондиционирование, интернет, охрана. Интерактивные планы этажей и свободные помещения онлайн.',
  keywords: ['аренда офиса Дмитров', 'аренда помещения Дмитров', 'офисы в аренду Дмитров', 'бизнес центр Дмитров', 'БЦ Маяк Дмитров'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: SITE.url,
    siteName: SITE.name,
    title: 'Аренда офисов в Дмитрове — Бизнес-центр «Маяк»',
    description: 'Современные офисные помещения от 10 м² в центре Дмитрова. Выберите офис на интерактивном плане этажа.',
    images: [{ url: '/images/building/01.jpg', width: 860, height: 397, alt: 'Бизнес-центр «Маяк» в Дмитрове' }],
  },
  robots: { index: true, follow: true },
}

const ORGANIZATION_LD = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: SITE.name,
  url: SITE.url,
  image: `${SITE.url}/images/building/01.jpg`,
  telephone: SITE.phone,
  email: SITE.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'мкр. им. Владимира Махалина, д. 20',
    addressLocality: 'Дмитров',
    addressRegion: 'Московская область',
    addressCountry: 'RU',
  },
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '09:00', closes: '18:00',
  }],
  areaServed: 'Дмитров',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
          Перейти к содержанию
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <MobileCtaBar />
        <FloatingContacts />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_LD) }} />
        {process.env.NODE_ENV === 'production' && (
          <Script id="ym" strategy="afterInteractive">{`
            try {
              (function(m,e,t,r,i,k,a){
                m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();
                k=e.createElement(t); k.async=1; k.src=r;
                a=e.getElementsByTagName(t)[0];
                if (a && a.parentNode) a.parentNode.insertBefore(k,a); else e.head.appendChild(k);
              })(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
              if (typeof window.ym === 'function') {
                window.ym(${YM_COUNTER},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true});
              }
            } catch (e) {
              // счётчик не должен ломать страницу
            }
          `}</Script>
        )}
      </body>
    </html>
  )
}
