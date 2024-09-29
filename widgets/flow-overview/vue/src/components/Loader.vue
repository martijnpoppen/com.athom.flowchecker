<template>
  <div class="loader" />
</template>
<style scoped>

.loader {
  width: 24px;
  height: 14px;
  --d: radial-gradient(farthest-side, currentColor 90%, #0000);
  background: var(--d), var(--d), var(--d);
  background-size: 6px 6px;
  background-repeat: no-repeat;
  animation: m 1s infinite;
}

@keyframes m {
  0% {
    background-position: calc(0 * 100% / 3) 100%, calc(1 * 100% / 3) 100%,
      calc(2 * 100% / 3) 100%, calc(3 * 100% / 3) 100%;
  }
  12.5% {
    background-position: calc(0 * 100% / 3) 0, calc(1 * 100% / 3) 100%,
      calc(2 * 100% / 3) 100%, calc(3 * 100% / 3) 100%;
  }
  25% {
    background-position: calc(0 * 100% / 3) 0, calc(1 * 100% / 3) 0,
      calc(2 * 100% / 3) 100%, calc(3 * 100% / 3) 100%;
  }
  37.5% {
    background-position: calc(0 * 100% / 3) 0, calc(1 * 100% / 3) 0,
      calc(2 * 100% / 3) 0, calc(3 * 100% / 3) 100%;
  }
  50% {
    background-position: calc(0 * 100% / 3) 0, calc(1 * 100% / 3) 0,
      calc(2 * 100% / 3) 0, calc(3 * 100% / 3) 0;
  }
  62.5% {
    background-position: calc(0 * 100% / 3) 100%, calc(1 * 100% / 3) 0,
      calc(2 * 100% / 3) 0, calc(3 * 100% / 3) 0;
  }
  75% {
    background-position: calc(0 * 100% / 3) 100%, calc(1 * 100% / 3) 100%,
      calc(2 * 100% / 3) 0, calc(3 * 100% / 3) 0;
  }
  87.5% {
    background-position: calc(0 * 100% / 3) 100%, calc(1 * 100% / 3) 100%,
      calc(2 * 100% / 3) 100%, calc(3 * 100% / 3) 0;
  }
  100% {
    background-position: calc(0 * 100% / 3) 100%, calc(1 * 100% / 3) 100%,
      calc(2 * 100% / 3) 100%, calc(3 * 100% / 3) 100%;
  }
}
</style>
