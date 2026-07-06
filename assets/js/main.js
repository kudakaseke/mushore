$(function () {
  const auth = window.CodeTechAuth || { loggedIn: true, loginUrl: 'index.html', productsUrl: 'products.html' };
  const paypalConfig = window.CodeTechPayPal || { currency: 'USD', sdkFailed: false };
  const checkoutState = window.CodeTechCheckout || { clearCart: false, paidOrder: null };
  const cartKey = 'codeTechCart';
  const purchaseHistoryKey = 'codeTechPurchaseHistory';
  let cart = loadCart();
  let paypalRendered = false;

  AOS.init({ duration: 900, once: true, offset: 80 });
  new PureCounter();

  const heroSwiper = $('.heroSwiper').length ? new Swiper('.heroSwiper', {
    loop: true,
    speed: 900,
    autoplay: { delay: 5000, disableOnInteraction: false },
    pagination: { el: '.heroSwiper .swiper-pagination', clickable: true }
  }) : null;

  let testimonialSwiper = null;

  function animateCounters() {
    $('[data-count-target]').each(function () {
      const element = $(this);
      const target = Number(element.data('count-target'));
      const suffix = element.data('count-suffix') || '';
      const duration = 650;
      const startTime = performance.now();

      function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const value = Math.floor(target * progress);
        element.text(`${value}${progress === 1 ? suffix : ''}`);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          element.text(`${target}${suffix}`);
        }
      }

      requestAnimationFrame(tick);
    });
  }

  function initTestimonialSwiper() {
    if ($('.testimonialSwiper').length) {
      testimonialSwiper = new Swiper('.testimonialSwiper', {
        loop: true,
        spaceBetween: 24,
        autoplay: { delay: 4500, disableOnInteraction: false },
        pagination: { el: '.testimonialSwiper .swiper-pagination', clickable: true },
        breakpoints: { 0: { slidesPerView: 1 }, 768: { slidesPerView: 2 }, 1200: { slidesPerView: 3 } }
      });
    }
  }

  function bindProductFilter() {
    $('.filter-btn').off('click').on('click', function () {
      const filter = $(this).data('filter');
      $('.filter-btn').removeClass('active');
      $(this).addClass('active');

      $('.project-item').each(function () {
        const category = $(this).data('category');
        if (filter === 'all' || category === filter) {
          $(this).fadeIn(250);
        } else {
          $(this).fadeOut(250);
        }
      });
    });
  }

  function renderProducts(products) {
    const grid = $('#projectGrid');
    if (!grid.length || !products || !products.length) return;

    const cards = products.map((product, index) => {
      const delay = (index % 3) * 80;
      return `
        <div class="col-md-6 col-lg-4 project-item" data-category="${product.category}" data-aos="fade-up" data-aos-delay="${delay}">
          <div class="product-card position-relative">
            <span class="sale-badge">Sale</span>
            <img src="${product.image}" alt="${product.title}" />
            <div class="product-body">
              <span class="product-category">${product.label}</span>
              <h5 class="mt-2">${product.title}</h5>
              <div class="stars mb-2"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star-half-stroke"></i></div>
              <div><span class="product-price">${product.price}</span><span class="old-price">${product.oldPrice}</span></div>
              <button class="btn btn-brand mt-3 w-100 add-cart" type="button" data-title="${product.title}" data-price="${product.amount}" data-label="${product.label}">Add to Cart</button>
            </div>
          </div>
        </div>`;
    }).join('');

    grid.html(cards);
    AOS.refresh();
  }

  function renderTestimonials(testimonials) {
    const wrapper = $('.testimonialSwiper .swiper-wrapper');
    if (!wrapper.length || !testimonials || !testimonials.length) return;

    const slides = testimonials.map((item) => `
      <div class="swiper-slide">
        <div class="testimonial-card">
          <p>${item.quote}</p>
          <div class="stars"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i></div>
          <h6>${item.name}</h6><span>${item.role}</span>
        </div>
      </div>`).join('');

    wrapper.html(slides);
  }

  $.getJSON('assets/data/site-data.json')
    .done(function (data) {
      renderProducts(data.products);
      renderTestimonials(data.testimonials);
      if (testimonialSwiper) {
        testimonialSwiper.destroy(true, true);
      }
      initTestimonialSwiper();
      bindProductFilter();
    })
    .fail(function () {
      initTestimonialSwiper();
      bindProductFilter();
    });

  if (!testimonialSwiper) {
    initTestimonialSwiper();
  }

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(cartKey)) || [];
    } catch (error) {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }

  function loadPurchaseHistory() {
    try {
      return JSON.parse(localStorage.getItem(purchaseHistoryKey)) || [];
    } catch (error) {
      return [];
    }
  }

  function savePurchase(orderId) {
    const history = loadPurchaseHistory();
    history.unshift({
      id: orderId || `CT-${Date.now()}`,
      date: new Date().toISOString(),
      total: cartTotal(),
      items: cart.map((item) => ({ ...item }))
    });
    localStorage.setItem(purchaseHistoryKey, JSON.stringify(history));
  }

  function saveExternalPurchase(order) {
    if (!order) return;

    const history = loadPurchaseHistory();
    history.unshift({
      id: order.id || `CT-${Date.now()}`,
      provider: order.provider || 'Payment',
      date: new Date().toISOString(),
      total: Number(order.total || 0),
      items: order.items || []
    });
    localStorage.setItem(purchaseHistoryKey, JSON.stringify(history));
  }

  function clearCartAfterConfirmedPayment() {
    if (!checkoutState.clearCart) return;

    saveExternalPurchase(checkoutState.paidOrder);
    cart = [];
    saveCart();
  }

  function renderPurchaseHistory() {
    const target = $('#purchaseHistory');
    if (!target.length) return;

    const history = loadPurchaseHistory();
    if (!history.length) {
      target.html('<p class="text-muted mb-0">No purchase history yet. Completed PayPal checkouts will appear here.</p>');
      return;
    }

    target.html(`
      <div class="purchase-history-list">
        ${history.map((order) => `
          <article class="purchase-card">
            <header>
              <div>
                <span>Order</span>
                <strong>${order.id}</strong>
              </div>
              <div class="text-end">
                <span>${new Date(order.date).toLocaleDateString()}</span>
                <strong>$${Number(order.total || 0).toFixed(2)}</strong>
              </div>
            </header>
            <ul>
              ${(order.items || []).map((item) => `<li>${item.title} - Qty ${item.quantity} - $${Number(item.price || 0).toFixed(2)}</li>`).join('')}
            </ul>
          </article>
        `).join('')}
      </div>
    `);
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  function renderCart() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    $('#cartCount').text(count);
    $('#cartTotal').text(`$${cartTotal().toFixed(2)}`);

    if (!cart.length) {
      $('#cartItems').html('<p class="text-muted">Your cart is empty.</p>');
      $('#paypalHint').text('Add products to cart to activate payment checkout.').show();
      $('#paypalServerCheckout, #paynowServerCheckout').prop('disabled', true);
      $('#paypal-button-container').empty();
      paypalRendered = false;
      return;
    }

    if (auth.paypalCheckoutUrl || auth.paynowCheckoutUrl) {
      $('#paypalHint').hide();
      $('#paypalServerCheckout, #paynowServerCheckout').prop('disabled', false);
    } else {
      $('#paypalHint').text('Cart preview is active. Payment checkout needs the Laravel backend.').show();
      $('#paypalServerCheckout, #paynowServerCheckout').prop('disabled', true);
    }
    $('#cartItems').html(cart.map((item, index) => `
      <div class="cart-item">
        <div>
          <h6>${item.title}</h6>
          <p>${item.label} - Qty ${item.quantity} - $${item.price.toFixed(2)}</p>
        </div>
        <button class="remove-cart-item" type="button" data-index="${index}">Remove</button>
      </div>
    `).join(''));

    renderServerCheckoutButton();
    paypalRendered = false;
  }

  function renderServerCheckoutButton() {
    const paypalContainer = $('#paypal-button-container');
    if (!paypalContainer.length || $('#paypalServerCheckout').length) return;

    paypalContainer.before(`
      <button class="btn btn-brand w-100 mt-3" id="paypalServerCheckout" type="button">
        Pay with PayPal
      </button>
      <button class="btn btn-outline-primary w-100 mt-2" id="paynowServerCheckout" type="button">
        Pay with Paynow
      </button>
    `);
  }

  function showPayPalMessage(message) {
    $('#paypalHint').text(message).show();
  }

  $(document).on('click', '#paypalServerCheckout', function () {
    if (!cart.length || !auth.paypalCheckoutUrl) return;

    const button = $(this);
    button.prop('disabled', true).text('Opening PayPal...');
    showPayPalMessage('Creating your PayPal order. You will be sent to PayPal to confirm payment.');

    $.ajax({
      url: auth.paypalCheckoutUrl,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        total: Number(cartTotal().toFixed(2)),
        items: cart
      }),
      headers: {
        'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content'),
        'Accept': 'application/json'
      }
    }).done(function (response) {
      if (response.redirect) {
        window.location.href = response.redirect;
        return;
      }
      showPayPalMessage('PayPal did not return a payment confirmation link.');
      button.prop('disabled', false).text('Pay with PayPal');
    }).fail(function (xhr) {
      const message = xhr.responseJSON && xhr.responseJSON.message
        ? xhr.responseJSON.message
        : 'PayPal checkout could not start.';
      showPayPalMessage(message);
      button.prop('disabled', false).text('Pay with PayPal');
    });
  });

  $(document).on('click', '#paynowServerCheckout', function () {
    if (!cart.length || !auth.paynowCheckoutUrl) return;

    const button = $(this);
    button.prop('disabled', true).text('Opening Paynow...');
    showPayPalMessage('Creating your Paynow order. You will be sent to Paynow to complete payment.');

    $.ajax({
      url: auth.paynowCheckoutUrl,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        total: Number(cartTotal().toFixed(2)),
        items: cart
      }),
      headers: {
        'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content'),
        'Accept': 'application/json'
      }
    }).done(function (response) {
      if (response.redirect) {
        window.location.href = response.redirect;
        return;
      }
      showPayPalMessage('Paynow did not return a payment link.');
      button.prop('disabled', false).text('Pay with Paynow');
    }).fail(function (xhr) {
      const message = xhr.responseJSON && xhr.responseJSON.message
        ? xhr.responseJSON.message
        : 'Paynow checkout could not start.';
      showPayPalMessage(message);
      button.prop('disabled', false).text('Pay with Paynow');
    });
  });

  $(document).on('click', '.add-cart', function () {
    const title = $(this).data('title');
    const price = Number($(this).data('price'));
    const label = $(this).data('label');
    const existing = cart.find((item) => item.title === title);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ title, price, label, quantity: 1 });
    }

    saveCart();
    renderCart();
    $(this).text('Added');
    alert(`Added ${title} to cart`);

    setTimeout(() => {
      $(this).text('Add to Cart');
    }, 1200);
  });

  $(document).on('click', '.remove-cart-item', function () {
    cart.splice(Number($(this).data('index')), 1);
    saveCart();
    renderCart();
  });

  $('.nav-link').on('click', function (e) {
    const target = $(this).attr('href');
    if (target && target.startsWith('#') && $(target).length) {
      e.preventDefault();
      $('html, body').animate({ scrollTop: $(target).offset().top - 70 }, 600);
      $('.navbar-collapse').collapse('hide');
    }
  });

  bindProductFilter();
  animateCounters();
  clearCartAfterConfirmedPayment();
  renderCart();
  renderPurchaseHistory();
});
