export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  authorName: string;
  imageUrl?: string;
  createdAt: any;
}

export const FALLBACK_NEWS_ARTICLES: NewsArticle[] = [
  {
    id: "news-1",
    title: "La Palabra Florida Ayuuk: Música y Tradición de la Sierra Mixe",
    content: "En el corazón de Santa María Tlahuitoltepec, el sonido de las trompetas, clarinetes y tubas resuena entre las montañas cubiertas de niebla. Para el pueblo Ayuuk (Mixe), la música no es solo entretenimiento; es un pilar sagrado de la vida social y ritual. El Centro de Capacitación Musical y Desarrollo de la Cultura Mixe (CECAM) ha sido el semillero de talentos que lleva nuestra identidad a todos los rincones del mundo. 'Nuestros instrumentos cantan para recordar que somos un pueblo libre y jamás conquistado', expresa Manuel Martínez, director comunitario del CECAM. A través del viento, las nuevas generaciones mantienen viva la lengua y la memoria histórica de nuestra región.",
    authorName: "Manuel Martínez (CECAM)",
    imageUrl: "https://picsum.photos/seed/mixe-music/1200/750",
    createdAt: { seconds: 1779218400 } // Pre-configured timestamp in future/recent
  },
  {
    id: "news-2",
    title: "El Tequio Ayuuk: La fuerza comunitaria que mueve montañas",
    content: "La autonomía de la Sierra Mixe se sostiene de hombro a hombro. El 'Tequio' —el trabajo comunitario no remunerado para el beneficio de todos— sigue siendo la institución social más vital de la región. Desde la pavimentación de caminos rurales hasta la cosecha de maíz y la restauración de centros ceremoniales, el esfuerzo colectivo une a familias y agencias municipales bajo una sola consigna: servir es honrar la tierra. Este sistema de ayuda mutua demuestra que es posible prosperar sin perder la esencia colectiva, resistiendo ante los desafíos modernos con un modelo económico solidario e intergeneracional.",
    authorName: "Silvia Juárez (Comunidad)",
    imageUrl: "https://picsum.photos/seed/mixe-tequio/1200/750",
    createdAt: { seconds: 1779132000 }
  },
  {
    id: "news-3",
    title: "Artesanías en Barro Rojo y Bordados con Símbolos de la Sierra",
    content: "Los textiles bordados a mano de Tlahuitoltepec y el barro rojo modelado con técnicas ancestrales cuentan historias de las deidades de la montaña, el jaguar, las flores silvestres y la neblina. En esta región, cada artesana plasma su cosmología en lienzos de algodón crudo y fango maleable. Hoy en día, las cooperativas de bordadoras Mixes luchan contra la apropiación cultural industrializada, promoviendo el reconocimiento justo del trabajo hecho a mano. Adquirir estas piezas representa apoyar directamente la soberanía económica de las mujeres mixes y asegurar la preservación de los saberes tradicionales que dan color a Oaxaca.",
    authorName: "Yolanda Vázquez (Artesana)",
    imageUrl: "https://picsum.photos/seed/mixe-crafts/1200/750",
    createdAt: { seconds: 1779045600 }
  }
];
