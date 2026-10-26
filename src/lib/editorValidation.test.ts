
import {
  describe,
  expect,
  it,
} from 'vitest';

import { seedDemo } from './seed';

import {
  validateEditor,
} from './editorValidation';

describe('NEXO CRM / validación de formularios', () => {
  it('acepta una oportunidad válida', () => {
    const data = seedDemo();

    expect(
      validateEditor(
        'deal',
        data.deals[0],
        data,
      ),
    ).toBeNull();
  });

  it('rechaza oportunidades sin título', () => {
    const data = seedDemo();

    const deal = {
      ...data.deals[0],
      title: '   ',
    };

    expect(
      validateEditor('deal', deal, data),
    ).not.toBeNull();
  });

  it('rechaza importes negativos', () => {
    const data = seedDemo();

    const deal = {
      ...data.deals[0],
      amount: -100,
    };

    expect(
      validateEditor('deal', deal, data),
    ).not.toBeNull();
  });

  it('rechaza contactos de otras empresas', () => {
    const data = seedDemo();

    const deal = {
      ...data.deals[0],
      companyId: 'c1',
      contactId: 'p2',
    };

    expect(
      validateEditor('deal', deal, data),
    ).toContain('otra empresa');
  });

  it('rechaza oportunidades con empresas inexistentes', () => {
    const data = seedDemo();

    const deal = {
      ...data.deals[0],
      companyId: 'empresa-inexistente',
    };

    expect(
      validateEditor('deal', deal, data),
    ).not.toBeNull();
  });

  it('acepta editar un contacto sin duplicar su correo', () => {
    const data = seedDemo();

    expect(
      validateEditor(
        'contact',
        data.contacts[0],
        data,
      ),
    ).toBeNull();
  });

  it('rechaza correos de contacto duplicados', () => {
    const data = seedDemo();

    const contact = {
      ...data.contacts[0],
      id: 'contacto-nuevo',
      email: ` ${data.contacts[0].email.toUpperCase()} `,
    };

    expect(
      validateEditor('contact', contact, data),
    ).toContain('Ya existe');
  });

  it('impide cambiar un contacto a una empresa incompatible', () => {
    const data = seedDemo();

    const contact = {
      ...data.contacts[0],
      companyId: 'c2',
    };

    expect(
      validateEditor('contact', contact, data),
    ).toContain('oportunidades asociadas');
  });

  it('rechaza nombres de empresa duplicados', () => {
    const data = seedDemo();

    const company = {
      ...data.companies[0],
      id: 'empresa-nueva',
      name: ` ${data.companies[0].name.toUpperCase()} `,
    };

    expect(
      validateEditor('company', company, data),
    ).toContain('Ya existe');
  });

  it('acepta crear una empresa diferente', () => {
    const data = seedDemo();

    const company = {
      ...data.companies[0],
      id: 'empresa-nueva',
      name: 'Empresa totalmente nueva',
    };

    expect(
      validateEditor('company', company, data),
    ).toBeNull();
  });

  it('rechaza tareas con fechas inválidas', () => {
    const data = seedDemo();

    const task = {
      ...data.tasks[0],
      dueDate: '2026-02-30',
    };

    expect(
      validateEditor('task', task, data),
    ).not.toBeNull();
  });

  it('rechaza tareas vinculadas a oportunidades inexistentes', () => {
    const data = seedDemo();

    const task = {
      ...data.tasks[0],
      dealId: 'no-existe',
    };

    expect(
      validateEditor('task', task, data),
    ).not.toBeNull();
  });

  it('evita crear dos tareas pendientes idénticas', () => {
    const data = seedDemo();

    const task = {
      ...data.tasks[0],
      id: 'tarea-nueva',
    };

    expect(
      validateEditor('task', task, data),
    ).toContain('Ya existe');
  });

  it('permite editar una tarea existente', () => {
    const data = seedDemo();

    expect(
      validateEditor(
        'task',
        data.tasks[0],
        data,
      ),
    ).toBeNull();
  });
});
