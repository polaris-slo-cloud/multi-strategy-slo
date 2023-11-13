import matplotlib.pyplot as plt

data = [499, 499, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1400, 1300, 1200, 1100, 1000, 900, 800, 700,
        600, 501]
item_duration_sec = 45


def plot_test_load():
  time = [index * item_duration_sec for index in range(len(data))]
  fig, axs = plt.subplots()
  axs.tick_params(axis='x', labelsize=8)
  axs.tick_params(axis='y', labelsize=8)
  axs.set_ylabel('CPU Load (milli)', fontsize=8)
  axs.set_xlabel('Time (sec)', fontsize=8, loc='center')
  axs.grid(linewidth=0.2)
  axs.step(time, data)
  plt.tight_layout()
  plt.gcf().set_size_inches(8, 6)
  # plt.show()
  plt.savefig('cpu-load.png', dpi=200)


plot_test_load()
