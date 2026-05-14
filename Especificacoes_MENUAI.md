# Documento de Especificações do Sistema MENUAI

## Proposta do Sistema
O MENUAI é uma solução para restaurantes criarem cardápios digitais acessíveis via QR Code, com integração ao WhatsApp para pedidos. O sistema é desenvolvido utilizando apenas HTML, CSS e JavaScript, garantindo simplicidade e acessibilidade.

---

## Estrutura do Sistema

### 1. Páginas HTML

#### [index.html](menuai-portatil/index.html)
- **Descrição**: Página inicial do sistema.
- **Funcionalidades**:
  - Navegação para funcionalidades, preços, login e cadastro.
  - Botões de chamada para ação: "Criar Cardápio Grátis" e "Já tenho conta".
  - Exibição de estatísticas de uso.
  - Apresentação das principais funcionalidades: Cardápio Digital, QR Code, Pedidos via WhatsApp.

#### [app.html](menuai-portatil/app.html)
- **Descrição**: Dashboard para gerenciar o cardápio.
- **Funcionalidades**:
  - Navegação entre Dashboard, Configurações e Admin.
  - Exibição de estatísticas dinâmicas (visualizações, pedidos via WhatsApp).

#### [login.html](menuai-portatil/login.html)
- **Descrição**: Página de login.
- **Funcionalidades**:
  - Formulário para autenticação com email e senha.
  - Integração com scripts de autenticação (`auth.js`).

#### [menu.html](menuai-portatil/menu.html)
- **Descrição**: Página do cardápio digital.
- **Funcionalidades**:
  - Exibição do cardápio com estado de carregamento e erro.
  - Carrinho de compras com botão para enviar pedido via WhatsApp.

#### [cadastro.html](menuai-portatil/cadastro.html)
- **Descrição**: Página de cadastro.
- **Funcionalidades**:
  - Formulário para criar conta e configurar restaurante.
  - Campos: Nome do Restaurante, WhatsApp, Categoria.

---

### 2. Scripts JavaScript

#### [app.js](menuai-portatil/js/app.js)
- **Descrição**: Gerencia a inicialização do aplicativo e a navegação entre as seções.
- **Principais Funções**:
  - `initApp()`: Inicializa o aplicativo, verifica autenticação e configura o roteador.
  - `setupRouter()`: Configura o roteador para lidar com mudanças de hash na URL.
  - `handleRoute()`: Controla a exibição de seções com base na rota atual.

#### [auth.js](menuai-portatil/js/auth.js)
- **Descrição**: Gerencia autenticação e sessão do usuário.
- **Principais Funções**:
  - `checkAuth()`: Verifica se o token de autenticação é válido.
  - `requireAuth()`: Redireciona para login se o usuário não estiver autenticado.
  - `login(email, password)`: Realiza login e armazena informações do usuário.
  - `logout()`: Finaliza a sessão e redireciona para a página de login.

#### [menu.js](menuai-portatil/js/menu.js)
- **Descrição**: Gerencia o cardápio e o carrinho de compras.
- **Principais Funções**:
  - `getSlugFromUrl()`: Obtém o identificador do restaurante a partir da URL.
  - `showToast(message)`: Exibe notificações temporárias.
  - `showLoading()` e `hideLoading()`: Controlam o estado de carregamento.
  - `showError()`: Exibe mensagens de erro.

#### [config.js](menuai-portatil/js/config.js)
- **Descrição**: Define configurações globais.
- **Principais Configurações**:
  - `__CONFIG__`: Contém a URL da API e emails de administradores.

#### [utils.js](menuai-portatil/js/utils.js)
- **Descrição**: Funções utilitárias para formatação e interações.
- **Principais Funções**:
  - `formatPrice(value)`: Formata valores monetários.
  - `generateSlug(text)`: Gera slugs amigáveis para URLs.
  - `whatsappLink(phone, text)`: Cria links para envio de mensagens no WhatsApp.
  - `showToast(message, type)`: Exibe notificações com diferentes tipos (sucesso, erro, aviso).
  - `openModal(id)` e `closeModal(id)`: Controlam a exibição de modais.

---

## Fluxos Principais

### 1. Cadastro de Restaurante
1. Usuário acessa [cadastro.html](menuai-portatil/cadastro.html).
2. Preenche os campos obrigatórios (Nome, WhatsApp, Categoria).
3. Submete o formulário, que chama a função `register()` em `auth.js`.
4. Dados são enviados para a API e o restaurante é registrado.

### 2. Login
1. Usuário acessa [login.html](menuai-portatil/login.html).
2. Preenche email e senha.
3. Submete o formulário, que chama a função `login()` em `auth.js`.
4. Usuário é redirecionado para o dashboard ([app.html](menuai-portatil/app.html)).

### 3. Navegação no Dashboard
1. Usuário logado acessa [app.html](menuai-portatil/app.html).
2. Navega entre as seções (Dashboard, Configurações, Admin).
3. Dados dinâmicos são carregados e exibidos.

### 4. Exibição do Cardápio
1. Cliente acessa [menu.html](menuai-portatil/menu.html) com o slug do restaurante.
2. Cardápio é carregado dinamicamente.
3. Cliente adiciona itens ao carrinho e envia pedido via WhatsApp.

---

## Conclusão
O sistema MENUAI é uma solução completa e eficiente para digitalização de cardápios, com foco em simplicidade e acessibilidade. Este documento detalha todas as funcionalidades e fluxos, permitindo que qualquer desenvolvedor recrie o sistema utilizando apenas HTML, CSS e JavaScript.