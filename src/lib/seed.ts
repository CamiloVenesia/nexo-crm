
import {
  CRMData,
  Company,
  Contact,
  Deal,
  Task,
  Activity,
  Stage,
} from '../types';

import { dayOffset, monthOffset, uid } from './utils';

export function seedDemo(): CRMData {
  const companySeeds: [string, string, string, string, string][] = [
    ['BrightLabs', 'Tecnología', 'brightlabs.example', 'Buenos Aires', '11-50'],
    ['Andes Tech', 'Software', 'andestech.example', 'Córdoba', '51-200'],
    ['Faro Digital', 'Marketing', 'farodigital.example', 'Rosario', '11-50'],
    ['Nova Retail', 'Comercio', 'novaretail.example', 'Buenos Aires', '51-200'],
    ['Lumen Studio', 'Diseño', 'lumenstudio.example', 'Mendoza', '1-10'],
    ['Pampa Logística', 'Logística', 'pampalog.example', 'Rosario', '51-200'],
    ['Órbita Labs', 'Tecnología', 'orbitalabs.example', 'Córdoba', '11-50'],
    ['Casa Norte', 'Construcción', 'casanorte.example', 'Santa Fe', '11-50'],
  ];

  const companies: Company[] = companySeeds.map(
    ([name, industry, website, location, employees], i) => ({
      id: `c${i + 1}`,
      name,
      industry,
      website,
      location,
      employees,
      createdAt: monthOffset(-4),
    }),
  );

  const contactSeeds: [string, string, string, string, string, string][] = [
    [
      'Marina Torres',
      'marina@brightlabs.example',
      '+54 11 5555 0101',
      'Directora comercial',
      'c1',
      'calificado',
    ],
    [
      'Tomás Peralta',
      'tomas@andestech.example',
      '+54 351 555 0102',
      'CEO',
      'c2',
      'contactado',
    ],
    [
      'Lucía Benítez',
      'lucia@farodigital.example',
      '+54 341 555 0103',
      'Coordinadora',
      'c3',
      'calificado',
    ],
    [
      'Santiago Ríos',
      'santiago@novaretail.example',
      '+54 11 5555 0104',
      'Gerente general',
      'c4',
      'nuevo',
    ],
    [
      'Valentina Costa',
      'valentina@lumenstudio.example',
      '+54 261 555 0105',
      'Fundadora',
      'c5',
      'contactado',
    ],
    [
      'Mateo Aguirre',
      'mateo@pampalog.example',
      '+54 341 555 0106',
      'Operaciones',
      'c6',
      'calificado',
    ],
    [
      'Paula Vega',
      'paula@orbitalabs.example',
      '+54 351 555 0107',
      'Compras',
      'c7',
      'contactado',
    ],
    [
      'Julián Franco',
      'julian@casanorte.example',
      '+54 342 555 0108',
      'Director',
      'c8',
      'nuevo',
    ],
    [
      'Sofía Ramos',
      'sofia@brightlabs.example',
      '+54 11 5555 0109',
      'Project Manager',
      'c1',
      'calificado',
    ],
    [
      'Nicolás Méndez',
      'nicolas@andestech.example',
      '+54 351 555 0110',
      'Marketing',
      'c2',
      'nuevo',
    ],
    [
      'Camila Duarte',
      'camila@novaretail.example',
      '+54 11 5555 0111',
      'Administración',
      'c4',
      'contactado',
    ],
    [
      'Federico Soto',
      'federico@farodigital.example',
      '+54 341 555 0112',
      'Socio',
      'c3',
      'nuevo',
    ],
  ];

  const contacts: Contact[] = contactSeeds.map(
    ([name, email, phone, role, companyId, status], i) => ({
      id: `p${i + 1}`,
      name,
      email,
      phone,
      role,
      companyId,
      status: status as Contact['status'],
      source:
        i % 3 === 0
          ? 'Referido'
          : i % 3 === 1
            ? 'Sitio web'
            : 'LinkedIn',
      notes: '',
      createdAt: monthOffset(-i % 4),
    }),
  );

  const dealSeeds: [
    string,
    string,
    string,
    number,
    Stage,
    number,
    number,
    string,
  ][] = [
    [
      'Transformación comercial',
      'c1',
      'p1',
      4800000,
      'prospeccion',
      15,
      14,
      'Relevamiento de necesidades inicial.',
    ],
    [
      'Plataforma interna',
      'c2',
      'p2',
      7350000,
      'calificacion',
      35,
      9,
      'Agendar reunión con dirección.',
    ],
    [
      'Rediseño de marca',
      'c3',
      'p3',
      3150000,
      'propuesta',
      65,
      21,
      'Presupuesto enviado el lunes.',
    ],
    [
      'Automatización de pedidos',
      'c4',
      'p4',
      5900000,
      'negociacion',
      85,
      6,
      'Ajustar condiciones de pago.',
    ],
    [
      'Web institucional',
      'c5',
      'p5',
      2400000,
      'prospeccion',
      20,
      12,
      'Primer contacto recibido.',
    ],
    [
      'Control de flota',
      'c6',
      'p6',
      9100000,
      'calificacion',
      40,
      28,
      'Necesita integración con GPS.',
    ],
    [
      'Portal de clientes',
      'c7',
      'p7',
      4200000,
      'propuesta',
      60,
      11,
      'Esperando devolución del comité.',
    ],
    [
      'CRM para ventas',
      'c8',
      'p8',
      3800000,
      'negociacion',
      80,
      4,
      'Reunión final pendiente.',
    ],
    [
      'Soporte y mantenimiento',
      'c1',
      'p9',
      1250000,
      'propuesta',
      70,
      -4,
      'Realizar seguimiento urgente.',
    ],
    [
      'Campaña de lanzamiento',
      'c2',
      'p10',
      1950000,
      'prospeccion',
      15,
      32,
      'Preparar propuesta creativa.',
    ],
    [
      'Optimización de inventario',
      'c4',
      'p11',
      6400000,
      'ganado',
      100,
      -16,
      'Acuerdo firmado.',
    ],
    [
      'Sitio corporativo',
      'c3',
      'p12',
      2750000,
      'ganado',
      100,
      -46,
      'Proyecto entregado.',
    ],
    [
      'Consultoría BI',
      'c6',
      'p6',
      3550000,
      'ganado',
      100,
      -66,
      'Proyecto cerrado.',
    ],
    [
      'Portal de proveedores',
      'c5',
      'p5',
      1750000,
      'ganado',
      100,
      -154,
      'Proyecto entregado meses atrás.',
    ],
    [
      'Analítica de negocios',
      'c7',
      'p7',
      3200000,
      'ganado',
      100,
      -125,
      'Implementación finalizada.',
    ],
    [
      'Estrategia digital',
      'c2',
      'p2',
      4600000,
      'ganado',
      100,
      -98,
      'Servicio entregado.',
    ],
    [
      'Campaña corporativa',
      'c3',
      'p3',
      1500000,
      'ganado',
      100,
      -82,
      'Campaña concluida.',
    ],
    [
      'Portal de clientes 2.0',
      'c6',
      'p6',
      5200000,
      'calificacion',
      40,
      62,
      'Definir nuevos módulos.',
    ],
    [
      'Módulo de reportes',
      'c1',
      'p1',
      3400000,
      'propuesta',
      60,
      48,
      'Cotización pendiente de revisión.',
    ],
    [
      'Migración de servidores',
      'c7',
      'p7',
      2250000,
      'perdido',
      0,
      -10,
      'Eligieron otra alternativa.',
    ],
    [
      'Integración de pasarela',
      'c5',
      'p5',
      1650000,
      'perdido',
      0,
      -33,
      'Sin presupuesto disponible.',
    ],
  ];

  const deals: Deal[] = dealSeeds.map(
    (
      [
        title,
        companyId,
        contactId,
        amount,
        stage,
        probability,
        dueOffset,
        notes,
      ],
      i,
    ) => ({
      id: `d${i + 1}`,
      title,
      companyId,
      contactId,
      amount,
      stage,
      probability,
      owner:
        i % 4 === 0
          ? 'Valentina López'
          : 'Equipo comercial',
      dueDate: dayOffset(dueOffset),
      notes,
      createdAt: monthOffset(-i % 5),
      updatedAt: monthOffset(-i % 3),
    }),
  );

  const taskSeeds: [
    string,
    number,
    Task['priority'],
    boolean,
    string,
    string,
  ][] = [
    [
      'Llamar a Marina por la propuesta',
      0,
      'alta',
      false,
      'd1',
      'Confirmar disponibilidad para presentación.',
    ],
    [
      'Enviar presupuesto final a Nova Retail',
      1,
      'alta',
      false,
      'd4',
      'Adjuntar cronograma de implementación.',
    ],
    [
      'Revisar contrato Casa Norte',
      -2,
      'alta',
      false,
      'd8',
      'Validar condiciones y fechas.',
    ],
    [
      'Preparar demo para Andes Tech',
      3,
      'media',
      false,
      'd2',
      'Incluir módulo de reportes.',
    ],
    [
      'Seguimiento de Faro Digital',
      -1,
      'alta',
      false,
      'd3',
      'Consultar decisión de compra.',
    ],
    [
      'Actualizar lista de contactos',
      5,
      'baja',
      false,
      '',
      'Completar datos faltantes.',
    ],
    [
      'Reunión de onboarding',
      2,
      'media',
      false,
      'd11',
      'Presentar equipo y próximos pasos.',
    ],
    [
      'Enviar material de producto',
      -4,
      'media',
      true,
      'd7',
      'Brochure enviado.',
    ],
    [
      'Revisar objetivos del mes',
      -7,
      'baja',
      true,
      '',
      'Plan comercial revisado.',
    ],
    [
      'Confirmar alcance de Pampa Logística',
      6,
      'media',
      false,
      'd6',
      'Definir entregables del proyecto.',
    ],
  ];

  const tasks: Task[] = taskSeeds.map(
    ([title, day, priority, done, dealId, description], i) => ({
      id: `t${i + 1}`,
      title,
      description,
      dueDate: dayOffset(day),
      priority,
      done,
      dealId,
      createdAt: monthOffset(-i % 2),
    }),
  );

  const activities: Activity[] = [
    [
      'deal',
      'Oportunidad ganada',
      'Nova Retail · Optimización de inventario',
    ],
    [
      'task',
      'Propuesta enviada',
      'Faro Digital · Rediseño de marca',
    ],
    [
      'contact',
      'Nuevo contacto',
      'Julián Franco se sumó al CRM',
    ],
    [
      'deal',
      'Negociación actualizada',
      'Casa Norte · CRM para ventas',
    ],
    [
      'company',
      'Empresa agregada',
      'Órbita Labs',
    ],
    [
      'task',
      'Tarea completada',
      'Enviar material de producto',
    ],
    [
      'deal',
      'Oportunidad creada',
      'Andes Tech · Plataforma interna',
    ],
    [
      'note',
      'Nota comercial',
      'Revisar objetivos del trimestre',
    ],
  ].map(([type, title, detail], i) => ({
    id: `a${i + 1}`,
    type: type as Activity['type'],
    title,
    detail,
    createdAt: new Date(
      Date.now() - i * 6 * 3600 * 1000,
    ).toISOString(),
  }));

  return {
    version: 1,
    deals,
    contacts,
    companies,
    tasks,
    activities,
    settings: {
      organization: 'NEXO Studio',
      currency: 'ARS',
      userName: 'Alex Morgan',
    },
  };
}

export function initialData() {
  try {
    const raw = localStorage.getItem('nexo-crm-v1');

    if (raw) {
      const d = JSON.parse(raw) as CRMData;

      if (
        d.version === 1 &&
        Array.isArray(d.deals) &&
        Array.isArray(d.contacts) &&
        Array.isArray(d.companies) &&
        Array.isArray(d.tasks) &&
        Array.isArray(d.activities) &&
        d.settings
      ) {
        return d;
      }
    }
  } catch {
    /* damaged storage or unavailable: show clean demo */
  }

  return seedDemo();
}

export const blankDeal = (): Omit<
  Deal,
  'id' | 'createdAt' | 'updatedAt'
> => ({
  title: '',
  companyId: '',
  contactId: '',
  amount: 0,
  stage: 'prospeccion',
  probability: 15,
  owner: 'Equipo comercial',
  dueDate: dayOffset(7),
  notes: '',
});

export const blankContact = (): Omit<
  Contact,
  'id' | 'createdAt'
> => ({
  name: '',
  email: '',
  phone: '',
  role: '',
  companyId: '',
  status: 'nuevo',
  source: 'Manual',
  notes: '',
});

export const blankCompany = (): Omit<
  Company,
  'id' | 'createdAt'
> => ({
  name: '',
  industry: '',
  website: '',
  location: '',
  employees: '1-10',
});

export const blankTask = (): Omit<
  Task,
  'id' | 'createdAt'
> => ({
  title: '',
  description: '',
  dueDate: dayOffset(1),
  priority: 'media',
  done: false,
  dealId: '',
});

export const createId = uid;
