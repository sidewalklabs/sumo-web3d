FROM kkarczmarczyk/node-yarn:8.0

# Install python3.6 from source.
RUN wget https://www.python.org/ftp/python/3.6.3/Python-3.6.3.tgz && \
  tar xvf Python-3.6.3.tgz && \
  cd Python-3.6.3 && \
  ./configure --enable-optimizations && \
  make -j8 && \
  make altinstall
